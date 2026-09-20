// Guided interview: the opportunity questions are read aloud one at a time and the applicant
// replies by voice or by typing. Spoken answers are transcribed into an editable box and are
// only added to the transcript after the applicant confirms them.

const apiFetch = (url: string, options: RequestInit) =>
  fetch(url, { ...options, headers: { ...options.headers, 'Content-Type': 'application/json', 'X-Resume-Client': '1' } });

// Matches the backend cap so a long edited question is never rejected after the request is sent.
const MAX_SPEECH_CHARACTERS = 800;

const recorderMimeTypeOptions = ['audio/ogg;codecs=opus', 'audio/ogg', 'audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];

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

// Resolves once speech starts rather than when it ends: some browsers expose speechSynthesis,
// accept the utterance and then never fire onend, which would leave the controls disabled.
function browserVoice(text: string): Promise<boolean> {
  return new Promise(resolve => {
    const synth = window.speechSynthesis;
    if (!synth || typeof SpeechSynthesisUtterance !== 'function') { resolve(false); return; }
    let settled = false;
    const settle = (spoke: boolean) => { if (!settled) { settled = true; resolve(spoke); } };
    try {
      synth.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.95;
      utterance.onstart = () => settle(true);
      utterance.onend = () => settle(true);
      utterance.onerror = () => settle(false);
      synth.speak(utterance);
      setTimeout(() => settle(false), 3000);
    } catch { settle(false); }
  });
}

export function mountGuidedInterview(host: HTMLElement, deps: GuidedDeps): void {
  host.insertAdjacentHTML('beforeend', `<section class="crb-guided">
  <div class="crb-guided-intro">
    <h3>Guided interview</h3>
    <p class="note">Your questions are read aloud one at a time. Answer by voice or by typing. Nothing is added to your transcript until you confirm it.</p>
    <button class="primary" id="guided-start" type="button">▶ Start guided interview</button>
    <p id="guided-intro-status" class="note" role="status"></p>
  </div>
  <div class="crb-guided-live" id="guided-live" hidden>
    <p class="crb-guided-progress" id="guided-progress"></p>
    <blockquote class="crb-guided-question" id="guided-question" tabindex="-1" aria-live="polite"></blockquote>
    <div class="crb-guided-controls">
      <button class="secondary" id="guided-replay" type="button">🔊 Read again</button>
      <button class="primary" id="guided-record" type="button">● Record answer</button>
      <button class="ghost" id="guided-skip" type="button">Skip this question</button>
      <button class="ghost" id="guided-stop" type="button">End guided interview</button>
    </div>
    <label for="guided-answer">Your answer — edit anything before you save it</label>
    <textarea id="guided-answer" rows="5" maxlength="12000" placeholder="Speak your answer, or type it here…"></textarea>
    <div class="crb-guided-controls">
      <button class="primary" id="guided-next" type="button">Save answer and continue →</button>
    </div>
    <p id="guided-status" class="note" role="status"></p>
  </div>
</section>`);

  const element = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
  const live = element('guided-live');
  const questionBox = element('guided-question');
  const answerBox = element<HTMLTextAreaElement>('guided-answer');
  const status = element('guided-status');
  const progress = element('guided-progress');
  const recordButton = element<HTMLButtonElement>('guided-record');
  const nextButton = element<HTMLButtonElement>('guided-next');
  const replayButton = element<HTMLButtonElement>('guided-replay');

  let questions: string[] = [];
  let index = 0;
  let answered = 0;
  let audio: HTMLAudioElement | null = null;
  let audioUrl = '';
  let recorder: MediaRecorder | null = null;
  let stream: MediaStream | null = null;
  let chunks: Blob[] = [];
  let busy = false;
  // Bumped whenever speech is superseded, so a slow attempt never overwrites a newer status message.
  let speechToken = 0;

  function stopSpeaking(): void {
    speechToken += 1;
    try { window.speechSynthesis?.cancel(); } catch { /* Speech synthesis is optional. */ }
    if (audio) { audio.pause(); audio = null; }
    if (audioUrl) { URL.revokeObjectURL(audioUrl); audioUrl = ''; }
  }

  async function playServerVoice(text: string): Promise<boolean> {
    const response = await apiFetch('/api/speak-question', {
      method: 'POST',
      body: JSON.stringify({ text: text.slice(0, MAX_SPEECH_CHARACTERS) }),
    });
    if (!response.ok) return false;
    const result = await response.json();
    if (!result?.audio) return false;
    const bytes = Uint8Array.from(atob(result.audio), char => char.charCodeAt(0));
    stopSpeaking();
    audioUrl = URL.createObjectURL(new Blob([bytes], { type: result.mimeType || 'audio/mpeg' }));
    const player = new Audio(audioUrl);
    audio = player;
    await player.play();
    return true;
  }

  async function speak(text: string): Promise<void> {
    stopSpeaking();
    const token = speechToken;
    replayButton.disabled = true;
    try {
      if (await playServerVoice(text)) return;
    } catch { /* Fall through to the free browser voice. */ }
    if (await browserVoice(text)) return;
    if (token !== speechToken) return;
    status.textContent = 'This browser cannot read the question aloud. The question is shown above.';
  }

  function showQuestion(): void {
    const question = questions[index];
    progress.textContent = `Question ${index + 1} of ${questions.length}`;
    questionBox.textContent = question;
    answerBox.value = '';
    status.textContent = '';
    questionBox.focus();
    void speak(question).finally(() => { replayButton.disabled = false; });
  }

  function finish(message: string): void {
    stopSpeaking();
    if (recorder && recorder.state !== 'inactive') recorder.stop();
    releaseMicrophone();
    live.hidden = true;
    element('guided-start').textContent = '▶ Start guided interview';
    element('guided-intro-status').textContent = message;
  }

  function releaseMicrophone(): void {
    stream?.getTracks().forEach(track => track.stop());
    stream = null;
    recorder = null;
  }

  function advance(): void {
    if (index + 1 >= questions.length) {
      finish(`Guided interview complete. You answered ${answered} of ${questions.length} questions. Your answers are in the transcript below and can be edited.`);
      return;
    }
    index += 1;
    showQuestion();
  }

  async function transcribeAnswer(blob: Blob): Promise<void> {
    busy = true;
    recordButton.disabled = true;
    nextButton.disabled = true;
    status.textContent = 'Transcribing your answer…';
    try {
      const buffer = await blob.arrayBuffer();
      let binary = '';
      const bytes = new Uint8Array(buffer);
      for (let position = 0; position < bytes.length; position += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(position, position + 0x8000));
      }
      const response = await apiFetch('/api/transcribe', {
        method: 'POST',
        body: JSON.stringify({
          data: btoa(binary),
          mimeType: blob.type || 'audio/webm',
          name: `guided-answer-${index + 1}.webm`,
          applicantName: deps.applicantName(),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error || 'Transcription failed.');
      const { text, speakers } = stripSpeakerLabels(String(result.transcript || ''));
      if (!text || /^\[NO INTELLIGIBLE SPEECH DETECTED\]$/i.test(text)) {
        status.textContent = 'No clear speech was detected. Record again or type your answer.';
        return;
      }
      answerBox.value = text;
      status.textContent = speakers > 1
        ? 'More than one speaker was detected. Keep only your own words before saving.'
        : 'Transcribed. Read it through and correct anything before you save it.';
      answerBox.focus();
    } catch (error) {
      status.textContent = error instanceof Error
        ? `${error.message} Your recording was not added. You can type this answer instead.`
        : 'Transcription is unavailable. You can type this answer instead.';
    } finally {
      busy = false;
      recordButton.disabled = false;
      nextButton.disabled = false;
    }
  }

  async function toggleRecording(): Promise<void> {
    if (recorder && recorder.state === 'recording') {
      recorder.stop();
      recordButton.textContent = '● Record answer';
      return;
    }
    if (busy) return;
    stopSpeaking();
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      status.textContent = 'Microphone access was refused. Type your answer instead.';
      return;
    }
    const mimeType = recorderMimeTypeOptions.find(option => MediaRecorder.isTypeSupported(option)) || '';
    recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    chunks = [];
    recorder.addEventListener('dataavailable', event => { if (event.data.size) chunks.push(event.data); });
    recorder.addEventListener('stop', () => {
      const blob = new Blob(chunks, { type: recorder?.mimeType || 'audio/webm' });
      releaseMicrophone();
      recordButton.textContent = '● Record answer';
      if (blob.size) void transcribeAnswer(blob);
    });
    recorder.start();
    recordButton.textContent = '■ Stop and transcribe';
    status.textContent = 'Recording. Answer in your own words, then stop.';
  }

  element('guided-start').onclick = () => {
    questions = parseQuestions(deps.questions());
    if (!questions.length) {
      element('guided-intro-status').textContent = 'Generate or paste interview questions under Self-assessment first.';
      return;
    }
    index = 0;
    answered = 0;
    live.hidden = false;
    element('guided-start').textContent = '▶ Restart guided interview';
    element('guided-intro-status').textContent = '';
    showQuestion();
  };

  replayButton.onclick = () => {
    replayButton.disabled = true;
    void speak(questions[index]).finally(() => { replayButton.disabled = false; });
  };

  recordButton.onclick = () => { void toggleRecording(); };

  nextButton.onclick = () => {
    if (busy) return;
    const answer = answerBox.value.trim();
    if (!answer) {
      status.textContent = 'Record or type an answer first, or skip this question.';
      return;
    }
    deps.onAnswer(questions[index], answer);
    answered += 1;
    advance();
  };

  element('guided-skip').onclick = () => {
    if (busy) return;
    // A skipped question stays unanswered. Missing evidence is never filled in on the applicant's behalf.
    advance();
  };

  element('guided-stop').onclick = () => {
    finish(`Guided interview stopped. You answered ${answered} of ${questions.length} questions.`);
  };

  window.addEventListener('pagehide', () => { stopSpeaking(); releaseMicrophone(); });
}
