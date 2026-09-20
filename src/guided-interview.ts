// Guided interview: a hands-free spoken conversation. CRB asks a question aloud, listens until the
// applicant stops speaking, transcribes the answer, and may ask one grounded follow-up before
// moving on. Every exchange lands in the editable transcript; nothing is invented on the
// applicant's behalf, and a skipped or silent question simply stays unanswered.

const apiFetch = (url: string, options: RequestInit) =>
  fetch(url, { ...options, headers: { ...options.headers, 'Content-Type': 'application/json', 'X-Resume-Client': '1' } });

const escape = (value: unknown) =>
  String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));

// Matches the backend cap so a long edited question is never rejected after the request is sent.
const MAX_SPEECH_CHARACTERS = 800;
const recorderMimeTypeOptions = ['audio/ogg;codecs=opus', 'audio/ogg', 'audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];

/** Turn-taking limits, in milliseconds. */
export const listening = {
  calibrateMs: 400,
  silenceMs: 2500,
  noSpeechMs: 12000,
  maxMs: 150000,
  minThreshold: 0.008,
  pollMs: 100,
};

export type GuidedDeps = {
  questions: () => string;
  applicantName: () => string;
  onAnswer: (question: string, answer: string) => void;
};

/** Splits the shared questions textarea into individual questions, numbered or blank-line separated. */
export function parseQuestions(raw: string): string[] {
  const text = String(raw ?? '');
  const lines = text.split(/\r?\n/);
  const blocks: string[] = [];
  if (lines.some(line => /^\s*\d+[.)]\s+\S/.test(line))) {
    let current: string[] = [];
    for (const line of lines) {
      if (/^\s*\d+[.)]\s+\S/.test(line)) {
        if (current.length) blocks.push(current.join(' '));
        current = [line.replace(/^\s*\d+[.)]\s+/, '')];
      } else if (current.length && line.trim()) {
        current.push(line.trim());
      }
    }
    if (current.length) blocks.push(current.join(' '));
  } else {
    for (const block of text.split(/\n\s*\n/)) blocks.push(block);
  }
  return blocks.map(block => block.replace(/\s+/g, ' ').trim()).filter(Boolean);
}

/** Removes a leading speaker label so a single spoken answer is not stored as "Applicant: Applicant: ...". */
export function stripSpeakerLabels(transcript: string): { text: string; speakers: number } {
  const labels = new Set<string>();
  const lines = String(transcript ?? '').split(/\r?\n/).map(line => {
    const match = line.match(/^\s*(applicant|candidate|student|speaker\s*\d+|recruiter|interviewer)\s*:\s*(.*)$/i);
    if (!match) return line.trim();
    labels.add(match[1].toLowerCase().replace(/\s+/g, ' '));
    return match[2].trim();
  });
  return { text: lines.filter(Boolean).join('\n').trim(), speakers: labels.size };
}

/** Noise floor measured while the microphone opens, so a quiet room and a busy one behave alike. */
export function speechThreshold(samples: readonly number[]): number {
  if (!samples.length) return listening.minThreshold;
  const mean = samples.reduce((total, value) => total + value, 0) / samples.length;
  return Math.max(mean * 3, listening.minThreshold);
}

export type TurnEnd = 'silence' | 'no-speech' | 'too-long' | null;

/** Decides when a spoken turn is over. Kept pure so the turn-taking rules are testable. */
export function endOfTurn(state: { heardSpeech: boolean; elapsedMs: number; sinceSpeechMs: number }): TurnEnd {
  if (state.elapsedMs >= listening.maxMs) return 'too-long';
  if (!state.heardSpeech) return state.elapsedMs >= listening.noSpeechMs ? 'no-speech' : null;
  return state.sinceSpeechMs >= listening.silenceMs ? 'silence' : null;
}

function browserVoice(text: string): Promise<boolean> {
  return new Promise(resolve => {
    const synth = window.speechSynthesis;
    if (!synth || typeof SpeechSynthesisUtterance !== 'function') { resolve(false); return; }
    let settled = false;
    let started = false;
    const settle = (spoke: boolean) => { if (!settled) { settled = true; resolve(spoke); } };
    try {
      synth.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.95;
      utterance.onstart = () => { started = true; };
      utterance.onend = () => settle(true);
      utterance.onerror = () => settle(false);
      synth.speak(utterance);
      // Some browsers accept an utterance and never fire onend; never block the conversation on it.
      setTimeout(() => settle(started), Math.min(3000 + text.length * 90, 30000));
    } catch { settle(false); }
  });
}

export function mountGuidedInterview(host: HTMLElement, deps: GuidedDeps): void {
  host.insertAdjacentHTML('beforeend', `<section class="crb-guided">
  <div class="crb-guided-intro">
    <h3>Guided interview</h3>
    <p class="note">A spoken conversation. CRB asks a question, listens until you stop speaking, then continues by itself. Everything said is saved to your editable transcript below.</p>
    <button class="primary" id="guided-start" type="button">▶ Start conversation</button>
    <p id="guided-intro-status" class="note" role="status"></p>
  </div>
  <div class="crb-guided-live" id="guided-live" hidden>
    <div class="crb-guided-statusbar">
      <span class="crb-guided-phase" id="guided-phase"></span>
      <span class="crb-guided-progress" id="guided-progress"></span>
    </div>
    <div class="crb-orb-stage"><div class="crb-orb" id="guided-orb" data-phase="idle" aria-hidden="true"><span class="crb-orb-core"></span></div></div>
    <blockquote class="crb-guided-question" id="guided-question" tabindex="-1" aria-live="polite"></blockquote>
    <div class="crb-guided-controls">
      <button class="secondary" id="guided-type" type="button">⌨ Type this answer</button>
      <button class="ghost" id="guided-skip" type="button">Skip question</button>
      <button class="ghost" id="guided-stop" type="button">End conversation</button>
    </div>
    <div class="crb-guided-typed" id="guided-typed-panel" hidden>
      <label for="guided-answer">Your answer</label>
      <textarea id="guided-answer" rows="4" maxlength="12000" placeholder="Type your answer, then send…"></textarea>
      <button class="primary" id="guided-send" type="button">Send and continue →</button>
    </div>
    <p id="guided-status" class="note" role="status"></p>
    <div class="crb-guided-log" id="guided-log" aria-label="Conversation so far"></div>
  </div>
</section>`);

  const element = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
  const live = element('guided-live');
  const questionBox = element('guided-question');
  const phaseBox = element('guided-phase');
  const progress = element('guided-progress');
  const status = element('guided-status');
  const log = element('guided-log');
  const typedPanel = element('guided-typed-panel');
  const answerBox = element<HTMLTextAreaElement>('guided-answer');
  const orb = element('guided-orb');

  let running = false;
  let questions: string[] = [];
  let index = 0;
  let answered = 0;
  let audio: HTMLAudioElement | null = null;
  let audioUrl = '';
  let recorder: MediaRecorder | null = null;
  let stream: MediaStream | null = null;
  let audioContext: AudioContext | null = null;
  let stopListening: ((reason: TurnEnd) => void) | null = null;
  // Skipping must abandon the turn outright rather than fall through to the typed prompt.
  let turnSignal: 'skip' | null = null;
  // A typed answer can be sent before the loop is ready for it, so it is buffered rather than lost.
  let typedResolve: ((text: string | null) => void) | null = null;
  let typedBuffer = '';

  type Phase = 'idle' | 'speaking' | 'listening' | 'thinking';
  // The orb is decorative and aria-hidden: the phase is always announced as text as well.
  function setPhase(text: string, phase: Phase): void {
    phaseBox.textContent = text;
    orb.dataset.phase = phase;
    if (phase !== 'listening') setOrbLevel(0);
  }
  /** Drives the orb from the measured microphone level, so it reacts to the applicant's voice. */
  function setOrbLevel(level: number): void {
    const eased = Math.min(level * 7, 1);
    orb.style.setProperty('--orb-scale', String(1 + eased * 0.28));
    orb.style.setProperty('--orb-glow', String(0.45 + eased * 0.5));
  }

  function addToLog(speaker: 'CRB' | 'You', text: string): void {
    log.insertAdjacentHTML('beforeend',
      `<p class="crb-guided-turn is-${speaker === 'CRB' ? 'crb' : 'applicant'}"><strong>${speaker}:</strong> ${escape(text)}</p>`);
    log.scrollTop = log.scrollHeight;
  }

  function releaseMicrophone(): void {
    stream?.getTracks().forEach(track => track.stop());
    stream = null;
    recorder = null;
    void audioContext?.close().catch(() => {});
    audioContext = null;
  }

  function stopSpeaking(): void {
    try { window.speechSynthesis?.cancel(); } catch { /* Speech synthesis is optional. */ }
    if (audio) { audio.pause(); audio = null; }
    if (audioUrl) { URL.revokeObjectURL(audioUrl); audioUrl = ''; }
  }

  /** Resolves when playback finishes, so the microphone never hears CRB's own voice. */
  async function speak(text: string): Promise<void> {
    stopSpeaking();
    try {
      const response = await apiFetch('/api/speak-question', {
        method: 'POST', body: JSON.stringify({ text: text.slice(0, MAX_SPEECH_CHARACTERS) }),
      });
      if (response.ok) {
        const result = await response.json();
        if (result?.audio) {
          const bytes = Uint8Array.from(atob(result.audio), char => char.charCodeAt(0));
          audioUrl = URL.createObjectURL(new Blob([bytes], { type: result.mimeType || 'audio/mpeg' }));
          const player = new Audio(audioUrl);
          audio = player;
          await player.play();
          await new Promise<void>(resolve => {
            player.addEventListener('ended', () => resolve(), { once: true });
            player.addEventListener('error', () => resolve(), { once: true });
          });
          return;
        }
      }
    } catch { /* Fall through to the free browser voice. */ }
    if (await browserVoice(text)) return;
    status.textContent = 'This browser cannot read questions aloud. Each question is shown above.';
  }

  /** Records until the applicant stops speaking. Resolves with null when nothing was said. */
  async function listen(): Promise<Blob | null> {
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    } catch {
      status.textContent = 'Microphone access was refused. Use "Type this answer" to continue.';
      return null;
    }
    const mimeType = recorderMimeTypeOptions.find(option => MediaRecorder.isTypeSupported(option)) || '';
    recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    const chunks: Blob[] = [];
    recorder.addEventListener('dataavailable', event => { if (event.data.size) chunks.push(event.data); });
    recorder.start();

    const context = new AudioContext();
    audioContext = context;
    const analyser = context.createAnalyser();
    analyser.fftSize = 2048;
    context.createMediaStreamSource(stream).connect(analyser);
    const frame = new Float32Array(analyser.fftSize);
    const calibration: number[] = [];
    const startedAt = Date.now();
    let heardSpeech = false;
    let lastSpeechAt = 0;
    let timer = 0;

    const reason = await new Promise<TurnEnd>(resolve => {
      stopListening = resolve;
      const tick = () => {
        analyser.getFloatTimeDomainData(frame);
        let total = 0;
        for (const value of frame) total += value * value;
        const level = Math.sqrt(total / frame.length);
        const elapsedMs = Date.now() - startedAt;
        if (elapsedMs < listening.calibrateMs) {
          calibration.push(level);
        } else {
          setOrbLevel(level);
          if (level > speechThreshold(calibration)) { heardSpeech = true; lastSpeechAt = Date.now(); }
          const end = endOfTurn({ heardSpeech, elapsedMs, sinceSpeechMs: heardSpeech ? Date.now() - lastSpeechAt : 0 });
          if (end) { resolve(end); return; }
        }
        timer = window.setTimeout(tick, listening.pollMs);
      };
      tick();
    });
    window.clearTimeout(timer);
    stopListening = null;

    const finished = new Promise<void>(resolve => recorder?.addEventListener('stop', () => resolve(), { once: true }));
    if (recorder.state !== 'inactive') recorder.stop();
    await finished;
    const blob = new Blob(chunks, { type: recorder?.mimeType || 'audio/webm' });
    releaseMicrophone();
    if (reason === 'no-speech' || !blob.size) return null;
    return blob;
  }

  async function transcribe(blob: Blob): Promise<string> {
    const buffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let position = 0; position < bytes.length; position += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(position, position + 0x8000));
    }
    const response = await apiFetch('/api/transcribe', {
      method: 'POST',
      body: JSON.stringify({
        data: btoa(binary), mimeType: blob.type || 'audio/webm',
        name: `guided-answer-${index + 1}.webm`, applicantName: deps.applicantName(),
      }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result?.error || 'Transcription failed.');
    const { text, speakers } = stripSpeakerLabels(String(result.transcript || ''));
    if (!text || /^\[NO INTELLIGIBLE SPEECH DETECTED\]$/i.test(text)) return '';
    if (speakers > 1) status.textContent = 'More than one speaker was detected. Check this answer in the transcript below.';
    return text;
  }

  /** Asks the existing reflection endpoint whether one grounded follow-up is worth asking. */
  async function followUpFor(question: string, answer: string): Promise<string> {
    try {
      const response = await apiFetch('/api/reflect-answer', { method: 'POST', body: JSON.stringify({ question, answer }) });
      if (!response.ok) return '';
      const result = await response.json();
      const follow = String(result?.excerpts?.followUpQuestion || result?.followUpQuestion || '').trim();
      return follow.length > 4 ? follow : '';
    } catch { return ''; }
  }

  function showTypedPanel(show: boolean): void {
    typedPanel.hidden = !show;
    if (show) answerBox.focus();
  }

  /** Typed answers use the same pipeline, so a refused microphone never ends the conversation. */
  function awaitTypedAnswer(): Promise<string | null> {
    if (typedBuffer) { const sent = typedBuffer; typedBuffer = ''; return Promise.resolve(sent); }
    showTypedPanel(true);
    setPhase('Waiting for your typed answer', 'idle');
    return new Promise(resolve => { typedResolve = resolve; });
  }

  async function askTurn(question: string, spokenLabel: string): Promise<string> {
    if (!running) return '';
    turnSignal = null;
    typedBuffer = '';
    answerBox.value = '';
    showTypedPanel(false);
    questionBox.textContent = question;
    questionBox.focus();
    setPhase(spokenLabel, 'speaking');
    addToLog('CRB', question);
    await speak(question);
    if (!running || turnSignal === 'skip') return '';

    setPhase('Listening…', 'listening');
    status.textContent = 'Listening. Pause when you have finished and CRB will continue.';
    const heard = typedPanel.hidden && !typedBuffer ? await listen() : null;
    if (!running || turnSignal === 'skip') return '';

    let answer = '';
    if (heard) {
      setPhase('Thinking…', 'thinking');
      status.textContent = 'Transcribing your answer…';
      try { answer = await transcribe(heard); }
      catch (error) {
        status.textContent = error instanceof Error
          ? `${error.message} Type this answer to continue.` : 'Transcription is unavailable. Type this answer to continue.';
      }
    }
    if (!answer && running && turnSignal !== 'skip') {
      const typed = await awaitTypedAnswer();
      answer = typed || '';
    }
    showTypedPanel(false);
    if (!running || !answer || turnSignal === 'skip') return '';
    addToLog('You', answer);
    deps.onAnswer(question, answer);
    answered += 1;
    status.textContent = '';
    return answer;
  }

  async function runConversation(): Promise<void> {
    while (running && index < questions.length) {
      progress.textContent = `Question ${index + 1} of ${questions.length}`;
      const question = questions[index];
      const answer = await askTurn(question, 'Asking…');
      if (running && answer) {
        setPhase('Thinking…', 'thinking');
        const follow = await followUpFor(question, answer);
        // One grounded follow-up only: this is a conversation, not an interrogation.
        if (follow && running) await askTurn(follow, 'Following up…');
      }
      if (!running) return;
      index += 1;
    }
    if (running) finish(`Conversation complete. You answered ${answered} of ${questions.length} questions. Everything is in the editable transcript below.`);
  }

  function finish(message: string): void {
    running = false;
    stopListening?.(null);
    typedResolve?.(null);
    typedResolve = null;
    stopSpeaking();
    if (recorder && recorder.state !== 'inactive') recorder.stop();
    releaseMicrophone();
    live.hidden = true;
    showTypedPanel(false);
    element('guided-start').textContent = '▶ Start conversation';
    element('guided-intro-status').textContent = message;
  }

  element('guided-start').onclick = () => {
    questions = parseQuestions(deps.questions());
    if (!questions.length) {
      element('guided-intro-status').textContent = 'Generate or paste interview questions under Self-assessment first.';
      return;
    }
    index = 0; answered = 0; running = true;
    log.replaceChildren();
    live.hidden = false;
    showTypedPanel(false);
    element('guided-start').textContent = '▶ Restart conversation';
    element('guided-intro-status').textContent = '';
    void runConversation();
  };

  element('guided-type').onclick = () => {
    // End listening so the spoken half-answer is discarded and the typed one is used instead.
    showTypedPanel(true);
    stopListening?.('no-speech');
  };

  element('guided-send').onclick = () => {
    const text = answerBox.value.trim();
    if (!text) { status.textContent = 'Type an answer, or skip this question.'; return; }
    typedPanel.hidden = true;
    if (typedResolve) { typedResolve(text); typedResolve = null; } else { typedBuffer = text; }
  };

  element('guided-skip').onclick = () => {
    // A skipped question stays unanswered. Missing evidence is never filled in for the applicant.
    turnSignal = 'skip';
    typedBuffer = '';
    stopListening?.('no-speech');
    typedResolve?.(null);
    typedResolve = null;
  };

  element('guided-stop').onclick = () => {
    finish(`Conversation ended. You answered ${answered} of ${questions.length} questions.`);
  };

  window.addEventListener('pagehide', () => { running = false; stopSpeaking(); releaseMicrophone(); });
}
