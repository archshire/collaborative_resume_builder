import './styles.css';

type Recording = {
  id: string;
  name: string;
  blob: Blob;
  url: string;
  durationLabel: string;
  createdAt: Date;
  transcribed?: boolean;
};

type SkillSignal = {
  label: string;
  score: number;
  evidence: string[];
};

type CandidateContext = {
  name: string;
  target: string;
};

type AiProfileCard = {
  label: string;
  evidenceStrength: number;
  evidence: string[];
  gap: string;
};

type AiArtifacts = {
  resumeMarkdown?: string;
  profileCards?: AiProfileCard[];
  feedbackMarkdown?: string;
  followUpQuestions?: string[];
};

type GenerationMode = 'resume' | 'profile';
type RecordingMode = 'initial' | 'followup';

const MAX_SECONDS = 10 * 60;
const EMPTY_RESUME_TEXT = 'Paste a transcript to generate a resume draft.';
const EMPTY_PROFILE_TEXT = 'Generate a profile to see strengths, interests, fit, and gaps.';
const EMPTY_FEEDBACK_TEXT = 'Generate outputs to see missing evidence and follow-up questions.';
const JOB_DESCRIPTION_CONTEXT = `Company
StartupDigital Services is a young company specializing in the creation of digital solutions for a diverse range of clients, including e-commerce, SaaS platforms, and business tools. We are looking for a junior freelance developer to strengthen our team on specific projects. You will collaborate with experienced developers to address the immediate needs of our clients.

Job Description
i) Feature Development:
Implement simple features on existing websites (forms, front-end modules, light back-end tasks).

ii) Minor Modifications:
Content integration, CSS style adjustments, or fixing HTML/JavaScript bugs.

iii) Testing and Validation:
Participate in technical testing to ensure the quality of deliverables.

iv) Technical Support:
Provide occasional assistance on client requests (improvements or quick adjustments).

v) Required Skills:
Basic knowledge of HTML, CSS, and JavaScript (Vanilla or simple frameworks like Vue.js or React).
Basic understanding of PHP or Python for light back-end tasks.
Familiarity with Git for version control (beginner level accepted).

vi) Experience:
A few completed personal or academic projects (portfolio or GitHub appreciated).
Previous freelance or internship experience is a plus but not mandatory.

vii) Personal Qualities:
Autonomy and reliability in meeting deadlines.
Ability to communicate clearly in writing for project follow-ups.
A strong desire to learn quickly in a hands-on environment.

viii) Duration:
Initial mission of 1 to 3 months, approximately 10 to 15 hours per week.

ix) Work Mode:
Remote work with weekly check-ins via video conferencing.

x) Why Join Us?
* Work on real, impactful projects for clients.
* Mentorship from experienced developers to help you grow your skills.
* Potential for extended collaboration based on your performance and our needs.`;
const INTERVIEW_QUESTIONS = [
  'Tell me about the relevant qualifications you have for the job and the period of time you spent pursuing it.',
  'Tell me about one project you completed and what you personally built.',
  'Which HTML, CSS, or JavaScript work have you done? Give concrete examples.',
  'Have you used Vue, React, or another front-end framework? What did you make with it?',
  'Have you used PHP or Python for back-end or scripting tasks? What problem did it solve?',
  'How comfortable are you with Git? Describe how you used it in a project.',
  'Tell me about a time you fixed a bug, tested a feature, or validated that something worked.',
  'How do you communicate progress, blockers, or follow-up notes to teammates or clients?',
  'Give an example of working independently and meeting a deadline.',
  'What would you do if a client requested a small urgent change on an existing website?',
  'What are you most eager to learn during a short freelance junior developer mission?',
];
const MAX_INLINE_AUDIO_BYTES = 18 * 1024 * 1024;
const recorderMimeTypeOptions = [
  'audio/ogg;codecs=opus',
  'audio/ogg',
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
];

let mediaRecorder: MediaRecorder | null = null;
let activeStream: MediaStream | null = null;
let chunks: BlobPart[] = [];
let timerId: number | null = null;
let secondsRemaining = MAX_SECONDS;
let recordingStartedAt: number | null = null;
let isPaused = false;
let recordings: Recording[] = [];
let transcriptionFiles: Recording[] = [];
let followupRecordings: Recording[] = [];
let followupTranscriptionFiles: Recording[] = [];
let activeRecordingMode: RecordingMode = 'initial';
let followupReady = false;
let lastProfileSignals: SkillSignal[] = [];
let lastProfileMarkdown = '';
let lastResumeMarkdown = '';
let lastUpdatedProfileMarkdown = '';
let lastUpdatedResumeMarkdown = '';
let lastFeedbackText = '';
let audioContext: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let waveformAnimationId: number | null = null;
let selectedAudioDeviceId = '';
let micTestStream: MediaStream | null = null;
let isMicTesting = false;

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('App root was not found.');
}

app.innerHTML = `
  <main class="shell">
    <section class="masthead">
      <div>
        <h1 class="brand-title">collaborative_resume_builder</h1>
        <p class="hero-line">A tool to help 42 students in Circle 6 enjoy the project without multitasking. :)</p>
      </div>
      <div class="status-card">
        <span class="status-dot" id="recording-dot"></span>
        <span id="recording-state">Ready</span>
      </div>
    </section>

    <section class="panel context-panel">
      <div class="panel-heading">
        <div>
          <h2>CONTEXT</h2>
        </div>
      </div>
      ${renderContextSectionHtml()}
    </section>

    <div class="part-heading-row">
      <h2 class="part-heading">Part 1 - Initial Interview</h2>
      <button class="new-session-button" id="new-session-top" type="button">New Session</button>
    </div>

    <section class="workspace">
      <aside class="panel recorder-panel">
        <div class="panel-heading">
          <div>
            <h2><span class="section-icon" aria-hidden="true">📼</span> INTERVIEW RECORDER</h2>
          </div>
          <div class="timer" id="timer">10:00</div>
        </div>

        <div class="identity-grid">
          <label>
            <span>Recruiter:</span>
            <input id="recruiter-name" type="text" />
          </label>
          <label>
            <span>Applicant:</span>
            <input id="applicant-name" type="text" />
          </label>
        </div>
        <p class="validation-message" id="recording-validation"></p>

        <div class="recorder-actions">
          <button class="icon-button record-button" id="start-recording" type="button" aria-label="Record" data-tooltip="Record">
            <span aria-hidden="true">●</span>
          </button>
          <button class="icon-button transport-button" id="pause-recording" type="button" aria-label="Pause recording" data-tooltip="Pause recording" disabled>
            <span aria-hidden="true">⏸</span>
          </button>
          <button class="icon-button transport-button" id="stop-recording" type="button" aria-label="Stop recording" data-tooltip="Stop recording" disabled>
            <span aria-hidden="true">■</span>
          </button>
        </div>

        <p class="note">Recordings stop automatically at ten minutes. Longer interviews can be captured as multiple chunks.</p>

        <div class="mic-diagnostics">
          <div class="mic-row">
            <select id="mic-select" aria-label="Microphone input">
              <option value="">Detecting microphones...</option>
            </select>
            <button class="ghost" id="test-mic" type="button">Check Mic</button>
          </div>
          <div class="mic-level" aria-label="Microphone input level">
            <span id="mic-level-fill"></span>
          </div>
          <p id="mic-status">Mic status: not checked.</p>
        </div>

        <section class="question-guide">
          <h3>Suggested interview questions</h3>
          <ol start="0">
            ${INTERVIEW_QUESTIONS.map((question) => `<li>${escapeHtml(question)}</li>`).join('')}
          </ol>
        </section>

        <canvas class="waveform" id="waveform" width="640" height="120" aria-label="Live microphone waveform"></canvas>

        <div class="recording-list" id="recording-list"></div>
      </aside>

      <section class="panel transcript-panel">
        <div class="panel-heading">
          <div>
            <h2><span class="section-icon" aria-hidden="true">📼</span> → <span class="section-icon" aria-hidden="true">📄</span> RECORDING TO TRANSCRIPT</h2>
          </div>
          <div class="panel-actions">
            <button class="ghost" id="load-sample" type="button">Load Sample</button>
          </div>
        </div>

        <div class="drop-zone" id="drop-zone">
          <input id="file-input" type="file" accept="audio/*,.ogg,.oga,.ogx,.opus,.webm,.m4a,.mp3,.wav,.aac,.flac" multiple />
          <p>Drop audio files for transcription here</p>
          <div class="transcription-file-list" id="transcription-file-list"></div>
          <button class="secondary drop-transcribe-button" id="transcribe-files" type="button" disabled>Transcribe</button>
        </div>

        <div class="transcription-helper hidden" id="transcription-helper"></div>

        <h3 class="transcription-title">Transcription</h3>
        <textarea class="hidden-transcript" id="transcript" spellcheck="true"></textarea>
        <div
          class="transcript-editor is-empty"
          id="transcript-editor"
          contenteditable="true"
          role="textbox"
          aria-label="Transcription"
          data-placeholder="Transcribed text for Interview will appear here."
        ></div>
      </section>
    </section>

    <section class="outputs">
      <article class="panel resume-output">
        <div class="panel-heading">
          <div>
            <h2><span class="section-icon" aria-hidden="true">👔</span> RESUME</h2>
          </div>
          <div class="panel-actions">
            <button class="primary" id="generate-resume" type="button" disabled>Generate Resume</button>
            <button class="ghost" id="copy-resume" type="button" disabled>Copy</button>
          </div>
        </div>
        <div id="resume-output" class="document-output empty-output">${EMPTY_RESUME_TEXT}</div>
        <div class="artifact-actions">
          <button class="ghost" id="download-resume" type="button" disabled>Download Resume</button>
        </div>
      </article>

      <article class="panel profile-output">
        <div class="panel-heading">
          <div>
            <h2><span class="section-icon" aria-hidden="true">★</span> SKILL PROFILE</h2>
          </div>
          <button class="secondary" id="generate-profile" type="button" disabled>Generate Skill Profile</button>
        </div>
        <div id="profile-output" class="profile-empty">${EMPTY_PROFILE_TEXT}</div>
        <div class="artifact-actions">
          <button class="ghost" id="download-profile" type="button" disabled>Download Skill Profile</button>
        </div>
      </article>

      <article class="panel feedback-output">
        <div class="panel-heading">
          <div>
            <h2><span class="section-icon" aria-hidden="true">?</span> INTERVIEW FEEDBACK</h2>
          </div>
        </div>
        <div id="feedback-output" class="feedback-stack empty-output">${EMPTY_FEEDBACK_TEXT}</div>
      </article>
    </section>

    <h2 class="part-heading">Part 2 - Follow-up questions</h2>

    <section class="workspace followup-workspace">
      <aside class="panel recorder-panel">
        <div class="panel-heading">
          <div>
            <h2><span class="section-icon" aria-hidden="true">📼</span> FOLLOW-UP RECORDER</h2>
          </div>
          <div class="timer" id="followup-timer">10:00</div>
        </div>

        <button class="ready-toggle" id="followup-ready" type="button">Ready to ask follow-up questions</button>
        <p class="validation-message" id="followup-recording-validation"></p>

        <div class="recorder-actions">
          <button class="icon-button record-button" id="followup-start-recording" type="button" aria-label="Record follow-up" data-tooltip="Record follow-up">
            <span aria-hidden="true">●</span>
          </button>
          <button class="icon-button transport-button" id="followup-pause-recording" type="button" aria-label="Pause follow-up recording" data-tooltip="Pause follow-up recording" disabled>
            <span aria-hidden="true">⏸</span>
          </button>
          <button class="icon-button transport-button" id="followup-stop-recording" type="button" aria-label="Stop follow-up recording" data-tooltip="Stop follow-up recording" disabled>
            <span aria-hidden="true">■</span>
          </button>
        </div>

        <p class="note">Use this after reviewing the AI feedback questions. Follow-up recordings are saved separately.</p>
        <canvas class="waveform" id="followup-waveform" width="640" height="120" aria-label="Live follow-up microphone waveform"></canvas>
        <div class="recording-list" id="followup-recording-list"></div>
      </aside>

      <section class="panel transcript-panel">
        <div class="panel-heading">
          <div>
            <h2><span class="section-icon" aria-hidden="true">📼</span> → <span class="section-icon" aria-hidden="true">📄</span> FOLLOW-UP RECORDING TO TRANSCRIPT</h2>
          </div>
        </div>

        <div class="drop-zone" id="followup-drop-zone">
          <input id="followup-file-input" type="file" accept="audio/*,.ogg,.oga,.ogx,.opus,.webm,.m4a,.mp3,.wav,.aac,.flac" multiple />
          <p>Drop follow-up audio files for transcription here</p>
          <div class="transcription-file-list" id="followup-transcription-file-list"></div>
          <button class="secondary drop-transcribe-button" id="followup-transcribe-files" type="button" disabled>Transcribe</button>
        </div>

        <div class="transcription-helper hidden" id="followup-transcription-helper"></div>

        <h3 class="transcription-title">Transcription</h3>
        <textarea class="hidden-transcript" id="followup-transcript" spellcheck="true"></textarea>
        <div
          class="transcript-editor is-empty"
          id="followup-transcript-editor"
          contenteditable="true"
          role="textbox"
          aria-label="Follow-up transcription"
          data-placeholder="Transcribed text for Follow-up Interview will appear here."
        ></div>
      </section>
    </section>

    <section class="outputs followup-outputs">
      <article class="panel resume-output">
        <div class="panel-heading">
          <div>
            <h2><span class="section-icon" aria-hidden="true">👔</span> UPDATED RESUME</h2>
          </div>
          <div class="panel-actions">
            <button class="primary" id="regenerate-resume" type="button" disabled>Re-generate Resume</button>
            <button class="ghost" id="copy-updated-resume" type="button" disabled>Copy</button>
          </div>
        </div>
        <div id="updated-resume-output" class="document-output empty-output">${EMPTY_RESUME_TEXT}</div>
        <div class="artifact-actions">
          <button class="ghost" id="save-updated-resume-pdf" type="button" disabled>Save as PDF</button>
          <button class="ghost" id="download-updated-resume" type="button" disabled>Download Resume</button>
        </div>
      </article>

      <article class="panel profile-output">
        <div class="panel-heading">
          <div>
            <h2><span class="section-icon" aria-hidden="true">★</span> UPDATED SKILL PROFILE</h2>
          </div>
          <button class="secondary" id="regenerate-profile" type="button" disabled>Re-generate Skill Profile</button>
        </div>
        <div id="updated-profile-output" class="profile-empty">${EMPTY_PROFILE_TEXT}</div>
        <div class="artifact-actions">
          <button class="ghost" id="download-updated-profile" type="button" disabled>Download Skill Profile</button>
        </div>
      </article>
    </section>

    <div class="session-footer">
      <button class="new-session-button" id="new-session-bottom" type="button">New Session</button>
    </div>
  </main>
`;

const recordingDot = getElement<HTMLSpanElement>('recording-dot');
const recordingState = getElement<HTMLSpanElement>('recording-state');
const timer = getElement<HTMLDivElement>('timer');
const followupTimer = getElement<HTMLDivElement>('followup-timer');
const startButton = getElement<HTMLButtonElement>('start-recording');
const pauseButton = getElement<HTMLButtonElement>('pause-recording');
const stopButton = getElement<HTMLButtonElement>('stop-recording');
const followupStartButton = getElement<HTMLButtonElement>('followup-start-recording');
const followupPauseButton = getElement<HTMLButtonElement>('followup-pause-recording');
const followupStopButton = getElement<HTMLButtonElement>('followup-stop-recording');
const followupReadyButton = getElement<HTMLButtonElement>('followup-ready');
const recruiterNameInput = getElement<HTMLInputElement>('recruiter-name');
const applicantNameInput = getElement<HTMLInputElement>('applicant-name');
const recordingValidation = getElement<HTMLParagraphElement>('recording-validation');
const followupRecordingValidation = getElement<HTMLParagraphElement>('followup-recording-validation');
const micSelect = getElement<HTMLSelectElement>('mic-select');
const testMicButton = getElement<HTMLButtonElement>('test-mic');
const micStatus = getElement<HTMLParagraphElement>('mic-status');
const micLevelFill = getElement<HTMLSpanElement>('mic-level-fill');
const dropZone = getElement<HTMLDivElement>('drop-zone');
const fileInput = getElement<HTMLInputElement>('file-input');
const followupDropZone = getElement<HTMLDivElement>('followup-drop-zone');
const followupFileInput = getElement<HTMLInputElement>('followup-file-input');
const recordingList = getElement<HTMLDivElement>('recording-list');
const followupRecordingList = getElement<HTMLDivElement>('followup-recording-list');
const waveform = getElement<HTMLCanvasElement>('waveform');
const followupWaveform = getElement<HTMLCanvasElement>('followup-waveform');
const transcriptionFileList = getElement<HTMLDivElement>('transcription-file-list');
const followupTranscriptionFileList = getElement<HTMLDivElement>('followup-transcription-file-list');
const transcriptionHelper = getElement<HTMLDivElement>('transcription-helper');
const followupTranscriptionHelper = getElement<HTMLDivElement>('followup-transcription-helper');
const transcript = getElement<HTMLTextAreaElement>('transcript');
const transcriptEditor = getElement<HTMLDivElement>('transcript-editor');
const followupTranscript = getElement<HTMLTextAreaElement>('followup-transcript');
const followupTranscriptEditor = getElement<HTMLDivElement>('followup-transcript-editor');
const transcribeFilesButton = getElement<HTMLButtonElement>('transcribe-files');
const followupTranscribeFilesButton = getElement<HTMLButtonElement>('followup-transcribe-files');
const generateResumeButton = getElement<HTMLButtonElement>('generate-resume');
const generateProfileButton = getElement<HTMLButtonElement>('generate-profile');
const regenerateResumeButton = getElement<HTMLButtonElement>('regenerate-resume');
const regenerateProfileButton = getElement<HTMLButtonElement>('regenerate-profile');
const resumeOutput = getElement<HTMLDivElement>('resume-output');
const profileOutput = getElement<HTMLDivElement>('profile-output');
const feedbackOutput = getElement<HTMLDivElement>('feedback-output');
const updatedResumeOutput = getElement<HTMLDivElement>('updated-resume-output');
const updatedProfileOutput = getElement<HTMLDivElement>('updated-profile-output');
const copyResumeButton = getElement<HTMLButtonElement>('copy-resume');
const copyUpdatedResumeButton = getElement<HTMLButtonElement>('copy-updated-resume');
const loadSampleButton = getElement<HTMLButtonElement>('load-sample');
const saveUpdatedResumePdfButton = getElement<HTMLButtonElement>('save-updated-resume-pdf');
const downloadResumeButton = getElement<HTMLButtonElement>('download-resume');
const downloadProfileButton = getElement<HTMLButtonElement>('download-profile');
const downloadUpdatedResumeButton = getElement<HTMLButtonElement>('download-updated-resume');
const downloadUpdatedProfileButton = getElement<HTMLButtonElement>('download-updated-profile');
const newSessionTopButton = getElement<HTMLButtonElement>('new-session-top');
const newSessionBottomButton = getElement<HTMLButtonElement>('new-session-bottom');

startButton.addEventListener('click', () => startRecording('initial'));
pauseButton.addEventListener('click', togglePauseRecording);
stopButton.addEventListener('click', () => stopRecording(true));
followupStartButton.addEventListener('click', () => startRecording('followup'));
followupPauseButton.addEventListener('click', togglePauseRecording);
followupStopButton.addEventListener('click', () => stopRecording(true));
followupReadyButton.addEventListener('click', () => {
  followupReady = true;
  followupReadyButton.classList.add('is-ready');
  followupReadyButton.textContent = 'Ready for follow-up questions';
  followupRecordingValidation.textContent = '';
});
testMicButton.addEventListener('click', toggleMicTest);
micSelect.addEventListener('change', () => {
  selectedAudioDeviceId = micSelect.value;
  if (isMicTesting) {
    stopMicTest(false);
    toggleMicTest();
  }
});
transcriptEditor.addEventListener('input', syncTranscriptFromEditor);
followupTranscriptEditor.addEventListener('input', syncFollowupTranscriptFromEditor);
applicantNameInput.addEventListener('input', () => {
  updateGeneratorState();
  clearRecordingValidation();
});
recruiterNameInput.addEventListener('input', clearRecordingValidation);
generateResumeButton.addEventListener('click', () => generateArtifacts('resume'));
generateProfileButton.addEventListener('click', () => generateArtifacts('profile'));
regenerateResumeButton.addEventListener('click', regenerateResume);
regenerateProfileButton.addEventListener('click', regenerateProfile);
copyResumeButton.addEventListener('click', copyResume);
copyUpdatedResumeButton.addEventListener('click', copyUpdatedResume);
loadSampleButton.addEventListener('click', loadSampleTranscript);
saveUpdatedResumePdfButton.addEventListener('click', () => saveResumeAsPdf(lastUpdatedResumeMarkdown));
transcribeFilesButton.addEventListener('click', (event) => {
  event.stopPropagation();
  transcribeAudioFiles(transcriptionFiles, 'initial');
});
followupTranscribeFilesButton.addEventListener('click', (event) => {
  event.stopPropagation();
  transcribeAudioFiles(followupTranscriptionFiles, 'followup');
});
downloadResumeButton.addEventListener('click', downloadResume);
downloadProfileButton.addEventListener('click', downloadProfile);
downloadUpdatedResumeButton.addEventListener('click', downloadUpdatedResume);
downloadUpdatedProfileButton.addEventListener('click', downloadUpdatedProfile);
newSessionTopButton.addEventListener('click', startNewSession);
newSessionBottomButton.addEventListener('click', startNewSession);

dropZone.addEventListener('click', () => fileInput.click());
transcriptionFileList.addEventListener('click', (event) => event.stopPropagation());
followupTranscriptionFileList.addEventListener('click', (event) => event.stopPropagation());
recordingList.addEventListener('click', handleRecordingAction);
followupRecordingList.addEventListener('click', handleRecordingAction);
transcriptionFileList.addEventListener('click', handleTranscriptionFileAction);
followupTranscriptionFileList.addEventListener('click', handleTranscriptionFileAction);
dropZone.addEventListener('dragover', (event) => {
  event.preventDefault();
  dropZone.classList.add('dragging');
});
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragging'));
dropZone.addEventListener('drop', (event) => {
  event.preventDefault();
  dropZone.classList.remove('dragging');
  addFiles(event.dataTransfer?.files, 'initial');
});
fileInput.addEventListener('change', () => addFiles(fileInput.files, 'initial'));
followupDropZone.addEventListener('click', () => followupFileInput.click());
followupDropZone.addEventListener('dragover', (event) => {
  event.preventDefault();
  followupDropZone.classList.add('dragging');
});
followupDropZone.addEventListener('dragleave', () => followupDropZone.classList.remove('dragging'));
followupDropZone.addEventListener('drop', (event) => {
  event.preventDefault();
  followupDropZone.classList.remove('dragging');
  addFiles(event.dataTransfer?.files, 'followup');
});
followupFileInput.addEventListener('change', () => addFiles(followupFileInput.files, 'followup'));
navigator.mediaDevices?.addEventListener?.('devicechange', updateAudioDevices);
updateAudioDevices();
stopWaveform();

function getElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing element: ${id}`);
  }
  return element as T;
}

function renderContextSectionHtml(): string {
  return `
    <div class="context-copy">
      <h3><u>Company</u></h3>
      <p>StartupDigital Services is a young company specializing in the creation of digital solutions for a diverse range of clients, including e-commerce, SaaS platforms, and business tools. We are looking for a junior freelance developer to strengthen our team on specific projects. You will collaborate with experienced developers to address the immediate needs of our clients.</p>

      <h3><u>Job Description</u></h3>
      <dl>
        <dt>i) Feature Development:</dt>
        <dd>Implement simple features on existing websites (forms, front-end modules, light back-end tasks).</dd>

        <dt>ii) Minor Modifications:</dt>
        <dd>Content integration, CSS style adjustments, or fixing HTML/JavaScript bugs.</dd>

        <dt>iii) Testing and Validation:</dt>
        <dd>Participate in technical testing to ensure the quality of deliverables.</dd>

        <dt>iv) Technical Support:</dt>
        <dd>Provide occasional assistance on client requests (improvements or quick adjustments).</dd>

        <dt>v) Required Skills:</dt>
        <dd>Basic knowledge of HTML, CSS, and JavaScript (Vanilla or simple frameworks like Vue.js or React). Basic understanding of PHP or Python for light back-end tasks. Familiarity with Git for version control (beginner level accepted).</dd>

        <dt>vi) Experience:</dt>
        <dd>A few completed personal or academic projects (portfolio or GitHub appreciated). Previous freelance or internship experience is a plus but not mandatory.</dd>

        <dt>vii) Personal Qualities:</dt>
        <dd>Autonomy and reliability in meeting deadlines. Ability to communicate clearly in writing for project follow-ups. A strong desire to learn quickly in a hands-on environment.</dd>

        <dt>viii) Duration:</dt>
        <dd>Initial mission of 1 to 3 months, approximately 10 to 15 hours per week.</dd>

        <dt>ix) Work Mode:</dt>
        <dd>Remote work with weekly check-ins via video conferencing.</dd>

        <dt>x) Why Join Us?</dt>
        <dd>
          <ul>
            <li>Work on real, impactful projects for clients.</li>
            <li>Mentorship from experienced developers to help you grow your skills.</li>
            <li>Potential for extended collaboration based on your performance and our needs.</li>
          </ul>
        </dd>
      </dl>
    </div>
  `;
}

async function startRecording(mode: RecordingMode): Promise<void> {
  const validationMessage = getRecordingValidationMessage(mode);
  if (validationMessage) {
    setRecordingValidation(validationMessage, mode);
    return;
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    setRecordingState('Microphone recording is not supported in this browser.', false);
    setMicStatus('Mic status: this browser does not support microphone capture.');
    return;
  }

  try {
    activeRecordingMode = mode;
    stopMicTest(false);
    activeStream = await navigator.mediaDevices.getUserMedia({ audio: buildAudioConstraints() });
    await updateAudioDevices();
    chunks = [];
    secondsRemaining = MAX_SECONDS;
    recordingStartedAt = Date.now();
    isPaused = false;
    startWaveform(activeStream);

    const preferredMimeType = getPreferredRecorderMimeType();
    mediaRecorder = preferredMimeType
      ? new MediaRecorder(activeStream, { mimeType: preferredMimeType })
      : new MediaRecorder(activeStream);

    mediaRecorder.addEventListener('dataavailable', (event) => {
      if (event.data.size > 0) {
        chunks.push(event.data);
      }
    });

    mediaRecorder.addEventListener('stop', saveActiveRecording);
    activeStream.getAudioTracks().forEach((track) => attachTrackDiagnostics(track));
    mediaRecorder.start();
    beginCountdown();
    setRecordingControls(mode, true);
    setRecordingState('Recording', true);
    setMicStatus(`Mic status: recording. ${describeAudioTrack(activeStream.getAudioTracks()[0])}`);
  } catch (error) {
    setRecordingState('Microphone permission was not granted.', false);
    setMicStatus('Mic status: permission denied or no microphone available.');
  }
}

function getRecordingValidationMessage(mode: RecordingMode = 'initial'): string {
  if (mode === 'followup' && !followupReady) {
    return 'click ready to ask follow-up questions first!';
  }

  if (mode === 'followup') {
    return '';
  }

  const missingRecruiter = recruiterNameInput.value.trim().length === 0;
  const missingApplicant = applicantNameInput.value.trim().length === 0;

  if (missingRecruiter && missingApplicant) {
    return 'Recruiter and Applicant are missing!';
  }
  if (missingRecruiter) {
    return 'Recruiter is missing!';
  }
  if (missingApplicant) {
    return 'Applicant is missing!';
  }
  return '';
}

function setRecordingValidation(message: string, mode: RecordingMode = 'initial'): void {
  if (mode === 'followup') {
    followupRecordingValidation.textContent = message;
    return;
  }
  recordingValidation.textContent = message;
}

function clearRecordingValidation(): void {
  if (!getRecordingValidationMessage('initial')) {
    recordingValidation.textContent = '';
  }
}

async function toggleMicTest(): Promise<void> {
  if (isMicTesting) {
    stopMicTest(true);
    return;
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    setMicStatus('Mic status: this browser does not support microphone capture.');
    return;
  }

  try {
    micTestStream = await navigator.mediaDevices.getUserMedia({ audio: buildAudioConstraints() });
    isMicTesting = true;
    testMicButton.textContent = 'Stop Test';
    await updateAudioDevices();
    micTestStream.getAudioTracks().forEach((track) => attachTrackDiagnostics(track));
    startWaveform(micTestStream);
    setMicStatus(`Mic status: testing. ${describeAudioTrack(micTestStream.getAudioTracks()[0])}`);
  } catch (error) {
    setMicStatus('Mic status: permission denied or no microphone available.');
  }
}

function stopMicTest(shouldResetWaveform: boolean): void {
  micTestStream?.getTracks().forEach((track) => track.stop());
  micTestStream = null;
  isMicTesting = false;
  testMicButton.textContent = 'Check Mic';

  if (shouldResetWaveform) {
    stopWaveform();
    setMicStatus('Mic status: test stopped.');
  }
}

function buildAudioConstraints(): boolean | MediaTrackConstraints {
  return selectedAudioDeviceId ? { deviceId: { exact: selectedAudioDeviceId } } : true;
}

async function updateAudioDevices(): Promise<void> {
  if (!navigator.mediaDevices?.enumerateDevices) {
    micSelect.innerHTML = '<option value="">No microphone API</option>';
    setMicStatus('Mic status: this browser cannot list microphones.');
    return;
  }

  const devices = await navigator.mediaDevices.enumerateDevices();
  const audioInputs = devices.filter((device) => device.kind === 'audioinput');
  micSelect.innerHTML = '';

  if (!audioInputs.length) {
    micSelect.innerHTML = '<option value="">No microphones detected</option>';
    selectedAudioDeviceId = '';
    setMicStatus('Mic status: no microphone detected by the browser.');
    return;
  }

  audioInputs.forEach((device, index) => {
    const option = document.createElement('option');
    option.value = device.deviceId;
    option.textContent = device.label || `Microphone ${index + 1}`;
    micSelect.appendChild(option);
  });

  if (selectedAudioDeviceId && audioInputs.some((device) => device.deviceId === selectedAudioDeviceId)) {
    micSelect.value = selectedAudioDeviceId;
  } else {
    selectedAudioDeviceId = audioInputs[0].deviceId;
    micSelect.value = selectedAudioDeviceId;
  }

  const labelHint = audioInputs.some((device) => device.label)
    ? `${audioInputs.length} microphone input${audioInputs.length === 1 ? '' : 's'} detected.`
    : `${audioInputs.length} microphone input${audioInputs.length === 1 ? '' : 's'} detected. Press Check Mic to reveal labels.`;
  setMicStatus(`Mic status: ${labelHint}`);
}

function setMicStatus(message: string): void {
  micStatus.textContent = message;
}

function attachTrackDiagnostics(track: MediaStreamTrack): void {
  track.addEventListener('mute', () => setMicStatus(`Mic status: browser track muted. ${describeAudioTrack(track)}`));
  track.addEventListener('unmute', () => setMicStatus(`Mic status: browser track unmuted. ${describeAudioTrack(track)}`));
  track.addEventListener('ended', () => setMicStatus(`Mic status: browser track ended. ${describeAudioTrack(track)}`));
}

function describeAudioTrack(track: MediaStreamTrack | undefined): string {
  if (!track) {
    return 'No audio track was created.';
  }

  const settings = track.getSettings() as MediaTrackSettings & { channelCount?: number };
  const details = [
    track.label || 'selected input',
    `state=${track.readyState}`,
    `enabled=${track.enabled ? 'yes' : 'no'}`,
    `muted=${track.muted ? 'yes' : 'no'}`,
  ];

  if (settings.sampleRate) details.push(`${settings.sampleRate}Hz`);
  if (settings.channelCount) details.push(`${settings.channelCount}ch`);

  return details.join(' · ');
}

function stopRecording(shouldSave: boolean): void {
  if (!mediaRecorder) {
    return;
  }

  if (!shouldSave) {
    chunks = [];
  }

  mediaRecorder.stop();
  stopWaveform();
  stopTracks();
  stopCountdown();
  setRecordingControls(activeRecordingMode, false);
  setRecordingState('Ready', false);
  isPaused = false;
  updatePauseButton();
}

function togglePauseRecording(): void {
  if (!mediaRecorder) {
    return;
  }

  if (mediaRecorder.state === 'recording') {
    mediaRecorder.pause();
    isPaused = true;
    setRecordingState('Paused', false);
  } else if (mediaRecorder.state === 'paused') {
    mediaRecorder.resume();
    isPaused = false;
    setRecordingState('Recording', true);
  }

  updatePauseButton();
}

function saveActiveRecording(): void {
  if (!chunks.length) {
    return;
  }

  const durationSeconds = recordingStartedAt ? Math.max(1, Math.round((Date.now() - recordingStartedAt) / 1000)) : 0;
  const mimeType = mediaRecorder?.mimeType || 'audio/webm';
  const extension = extensionForMimeType(mimeType);
  const blob = new Blob(chunks, { type: mimeType });
  const id = crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
  const applicantSlug = sessionSlug();
  const targetRecordings = activeRecordingMode === 'followup' ? followupRecordings : recordings;
  const nameRoot = activeRecordingMode === 'followup' ? `${applicantSlug}_follow_up` : `${applicantSlug}_interview`;
  const recording: Recording = {
    id,
    name: targetRecordings.length
      ? `${nameRoot}-${targetRecordings.length + 1}.${extension}`
      : `${nameRoot}.${extension}`,
    blob,
    url: URL.createObjectURL(blob),
    durationLabel: formatDuration(durationSeconds),
    createdAt: new Date(),
  };

  if (activeRecordingMode === 'followup') {
    followupRecordings = [...followupRecordings, recording];
  } else {
    recordings = [...recordings, recording];
  }
  renderRecordings(activeRecordingMode);
  updateExportState();
  chunks = [];
  mediaRecorder = null;
  recordingStartedAt = null;
}

function getPreferredRecorderMimeType(): string {
  return recorderMimeTypeOptions.find((mimeType) => MediaRecorder.isTypeSupported(mimeType)) || '';
}

function extensionForMimeType(mimeType: string): string {
  const lowerMimeType = mimeType.toLowerCase();
  if (lowerMimeType.includes('ogg') || lowerMimeType.includes('opus')) return 'ogg';
  if (lowerMimeType.includes('mp4')) return 'm4a';
  if (lowerMimeType.includes('wav')) return 'wav';
  return 'webm';
}

function startWaveform(stream: MediaStream): void {
  stopWaveform();
  const audioWindow = window as Window & { webkitAudioContext?: typeof AudioContext };
  const AudioContextConstructor = window.AudioContext || audioWindow.webkitAudioContext;
  if (!AudioContextConstructor) {
    return;
  }

  audioContext = new AudioContextConstructor();
  analyser = audioContext.createAnalyser();
  analyser.fftSize = 2048;

  const source = audioContext.createMediaStreamSource(stream);
  source.connect(analyser);
  drawWaveform();
}

function drawWaveform(): void {
  const activeWaveform = activeRecordingMode === 'followup' ? followupWaveform : waveform;
  const canvasContext = activeWaveform.getContext('2d');
  if (!canvasContext || !analyser) {
    return;
  }

  const buffer = new Uint8Array(analyser.fftSize);
  analyser.getByteTimeDomainData(buffer);
  updateInputLevel(buffer);

  canvasContext.clearRect(0, 0, activeWaveform.width, activeWaveform.height);
  canvasContext.fillStyle = '#ffffff';
  canvasContext.fillRect(0, 0, activeWaveform.width, activeWaveform.height);
  canvasContext.lineWidth = 4;
  canvasContext.strokeStyle = isPaused ? '#8a94a6' : '#0f9f9a';
  canvasContext.beginPath();

  const sliceWidth = activeWaveform.width / buffer.length;
  let x = 0;

  buffer.forEach((value, index) => {
    const centered = value - 128;
    const y = activeWaveform.height / 2 + (centered / 128) * activeWaveform.height * 1.8;
    if (index === 0) {
      canvasContext.moveTo(x, y);
    } else {
      canvasContext.lineTo(x, y);
    }
    x += sliceWidth;
  });

  canvasContext.stroke();
  waveformAnimationId = window.requestAnimationFrame(drawWaveform);
}

function stopWaveform(): void {
  if (waveformAnimationId !== null) {
    window.cancelAnimationFrame(waveformAnimationId);
    waveformAnimationId = null;
  }

  audioContext?.close();
  audioContext = null;
  analyser = null;
  micLevelFill.style.width = '0%';

  [waveform, followupWaveform].forEach((targetWaveform) => {
    const canvasContext = targetWaveform.getContext('2d');
    if (!canvasContext) {
      return;
    }
    canvasContext.clearRect(0, 0, targetWaveform.width, targetWaveform.height);
    canvasContext.fillStyle = '#ffffff';
    canvasContext.fillRect(0, 0, targetWaveform.width, targetWaveform.height);
    canvasContext.strokeStyle = '#c9d7ea';
    canvasContext.lineWidth = 3;
    canvasContext.beginPath();
    canvasContext.moveTo(0, targetWaveform.height / 2);
    canvasContext.lineTo(targetWaveform.width, targetWaveform.height / 2);
    canvasContext.stroke();
  });
}

function updateInputLevel(buffer: Uint8Array): void {
  let sum = 0;
  buffer.forEach((value) => {
    const centered = value - 128;
    sum += centered * centered;
  });

  const rms = Math.sqrt(sum / buffer.length);
  const percent = Math.min(100, Math.round((rms / 12) * 100));
  micLevelFill.style.width = `${percent}%`;

  if ((isMicTesting || mediaRecorder?.state === 'recording') && percent > 2) {
    const track = (micTestStream || activeStream)?.getAudioTracks()[0];
    setMicStatus(`Mic status: input detected (${percent}%). ${describeAudioTrack(track)}`);
  }
}

function beginCountdown(): void {
  updateTimer();
  timerId = window.setInterval(() => {
    if (isPaused) {
      return;
    }

    secondsRemaining -= 1;
    updateTimer();

    if (secondsRemaining <= 0) {
      stopRecording(true);
    }
  }, 1000);
}

function stopCountdown(): void {
  if (timerId !== null) {
    window.clearInterval(timerId);
    timerId = null;
  }
  secondsRemaining = MAX_SECONDS;
  updateTimer();
}

function updateTimer(): void {
  const activeTimer = activeRecordingMode === 'followup' ? followupTimer : timer;
  activeTimer.textContent = formatDuration(secondsRemaining);
}

function setRecordingControls(mode: RecordingMode, isRecording: boolean): void {
  const controls = getRecordingControls(mode);
  controls.start.disabled = isRecording;
  controls.pause.disabled = !isRecording;
  controls.stop.disabled = !isRecording;
  updatePauseButton();
}

function updatePauseButton(): void {
  const controls = getRecordingControls(activeRecordingMode);
  controls.pause.innerHTML = isPaused ? '<span aria-hidden="true">▶</span>' : '<span aria-hidden="true">⏸</span>';
  controls.pause.setAttribute('aria-label', isPaused ? 'Resume recording' : 'Pause recording');
  controls.pause.setAttribute('data-tooltip', isPaused ? 'Resume recording' : 'Pause recording');
}

function getRecordingControls(mode: RecordingMode): { start: HTMLButtonElement; pause: HTMLButtonElement; stop: HTMLButtonElement } {
  return mode === 'followup'
    ? { start: followupStartButton, pause: followupPauseButton, stop: followupStopButton }
    : { start: startButton, pause: pauseButton, stop: stopButton };
}

function setRecordingState(label: string, isRecording: boolean): void {
  recordingState.textContent = label;
  recordingDot.classList.toggle('active', isRecording);
}

function stopTracks(): void {
  activeStream?.getTracks().forEach((track) => track.stop());
  activeStream = null;
}

function addFiles(files: FileList | null | undefined, mode: RecordingMode): void {
  if (!files?.length) {
    return;
  }

  const imported = Array.from(files)
    .filter(isSupportedAudioFile)
    .map((file) => ({
      id: crypto.randomUUID ? crypto.randomUUID() : `${file.name}-${Date.now()}`,
      name: file.name,
      blob: file,
      url: URL.createObjectURL(file),
      durationLabel: 'uploaded',
      createdAt: new Date(),
    }));

  if (mode === 'followup') {
    followupTranscriptionFiles = [...followupTranscriptionFiles, ...imported];
  } else {
    transcriptionFiles = [...transcriptionFiles, ...imported];
  }
  renderTranscriptionFiles(mode);
  updateTranscribeState(mode);
  updateExportState();
}

function isSupportedAudioFile(file: File): boolean {
  const audioExtensions = ['.ogg', '.oga', '.ogx', '.opus', '.webm', '.m4a', '.mp3', '.wav', '.aac', '.flac'];
  const lowerName = file.name.toLowerCase();

  return (
    file.type.startsWith('audio/') ||
    file.type === 'application/ogg' ||
    file.type === 'video/ogg' ||
    audioExtensions.some((extension) => lowerName.endsWith(extension))
  );
}

function renderRecordings(mode: RecordingMode = 'initial'): void {
  const targetRecordings = mode === 'followup' ? followupRecordings : recordings;
  const targetList = mode === 'followup' ? followupRecordingList : recordingList;
  if (!targetRecordings.length) {
    targetList.innerHTML = '';
    return;
  }

  targetList.innerHTML = targetRecordings
    .map(
      (recording, index) => `
        <div class="recording-item">
          <span class="recording-number">${index + 1}</span>
          <div>
            <strong>${escapeHtml(recording.name)}</strong>
            <span>${recording.durationLabel} · ${recording.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          <div class="recording-actions">
            <button class="mini-action transcribe-recording ${recording.transcribed ? 'is-transcribed' : ''}" type="button" data-recording-mode="${mode}" data-recording-id="${recording.id}" ${recording.transcribed ? 'disabled' : ''}>${recording.transcribed ? 'transcribed' : 'Transcribe'}</button>
            <a class="download-icon" href="${recording.url}" download="${escapeHtml(recording.name)}" aria-label="Download recording ${index + 1}" data-tooltip="Download recording ${index + 1}">⬇</a>
          </div>
        </div>
      `,
    )
    .join('');
}

function renderTranscriptionFiles(mode: RecordingMode = 'initial'): void {
  const targetFiles = mode === 'followup' ? followupTranscriptionFiles : transcriptionFiles;
  const targetList = mode === 'followup' ? followupTranscriptionFileList : transcriptionFileList;
  const targetHelper = mode === 'followup' ? followupTranscriptionHelper : transcriptionHelper;
  if (!targetFiles.length) {
    targetList.innerHTML = '';
    targetHelper.classList.add('hidden');
    return;
  }

  targetList.innerHTML = targetFiles
    .map(
      (recording, index) => `
        <div class="recording-item transcription-file">
          <span class="recording-number">${index + 1}</span>
          <div>
            <strong>${escapeHtml(recording.name)}</strong>
            <span>${recording.transcribed ? 'transcribed' : 'ready for transcription'} · ${recording.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          <button class="remove-file" type="button" aria-label="Remove ${escapeHtml(recording.name)}" data-file-mode="${mode}" data-file-id="${recording.id}">x</button>
        </div>
      `,
    )
    .join('');
}

function updateTranscribeState(mode: RecordingMode = 'initial'): void {
  if (mode === 'followup') {
    followupTranscribeFilesButton.disabled = followupTranscriptionFiles.every((file) => file.transcribed);
    return;
  }
  transcribeFilesButton.disabled = transcriptionFiles.every((file) => file.transcribed);
}

function handleRecordingAction(event: MouseEvent): void {
  const target = event.target as HTMLElement;
  const button = target.closest<HTMLButtonElement>('.transcribe-recording');
  if (!button) {
    return;
  }

  const mode = button.dataset.recordingMode === 'followup' ? 'followup' : 'initial';
  const targetRecordings = mode === 'followup' ? followupRecordings : recordings;
  const recording = targetRecordings.find((item) => item.id === button.dataset.recordingId);
  if (!recording) {
    return;
  }

  transcribeAudioFiles([recording], mode);
}

function handleTranscriptionFileAction(event: MouseEvent): void {
  const target = event.target as HTMLElement;
  const button = target.closest<HTMLButtonElement>('.remove-file');
  if (!button) {
    return;
  }

  const mode = button.dataset.fileMode === 'followup' ? 'followup' : 'initial';
  if (mode === 'followup') {
    followupTranscriptionFiles = followupTranscriptionFiles.filter((file) => file.id !== button.dataset.fileId);
  } else {
    transcriptionFiles = transcriptionFiles.filter((file) => file.id !== button.dataset.fileId);
  }
  renderTranscriptionFiles(mode);
  updateTranscribeState(mode);
}

async function transcribeAudioFiles(filesToTranscribe = transcriptionFiles, mode: RecordingMode = 'initial'): Promise<void> {
  const pendingFiles = filesToTranscribe.filter((file) => !file.transcribed);
  if (!pendingFiles.length) {
    return;
  }

  const targetButton = mode === 'followup' ? followupTranscribeFilesButton : transcribeFilesButton;
  const targetHelper = mode === 'followup' ? followupTranscriptionHelper : transcriptionHelper;
  targetButton.disabled = true;
  targetHelper.classList.remove('hidden');
  targetHelper.innerHTML = '<strong>Transcribing audio...</strong><p>Sending uploaded recordings to transcription providers. Keep this page open.</p>';

  try {
    const transcriptChunks: string[] = [];

    for (let index = 0; index < pendingFiles.length; index += 1) {
      const file = pendingFiles[index];
      if (file.blob.size > MAX_INLINE_AUDIO_BYTES) {
        throw new Error(`${file.name} is too large for V2A inline transcription. Keep files below 18 MB for now.`);
      }

      targetHelper.innerHTML = `<strong>Transcribing audio...</strong><p>Processing ${index + 1} of ${pendingFiles.length}: ${escapeHtml(file.name)}</p>`;
      const data = await blobToBase64(file.blob);
      const response = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: file.name,
          mimeType: normalizeAudioMimeType(file.blob.type, file.name),
          applicantName: applicantNameInput.value.trim(),
          data,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        const detailText = Array.isArray(result.details) && result.details.length
          ? `\n\n${result.details.join('\n')}`
          : '';
        throw new Error(`${result.error || 'Transcription failed.'}${detailText}`);
      }

      transcriptChunks.push(`Transcript chunk ${index + 1} - ${file.name}\n${result.transcript}`);
      file.transcribed = true;
    }

    const combinedTranscript = transcriptChunks.join('\n\n');
    const currentTranscript = mode === 'followup' ? followupTranscript.value : transcript.value;
    setTranscriptValue(currentTranscript.trim()
      ? `${currentTranscript.trim()}\n\n${combinedTranscript}`
      : combinedTranscript, mode);

    targetHelper.innerHTML = '<strong>Transcription complete</strong><p>The transcript box has been updated. Review the text before generating artifacts.</p>';
    renderRecordings(mode);
    renderTranscriptionFiles(mode);
    updateGeneratorState();
  } catch (error) {
    showTranscriptionFallback(error instanceof Error ? error.message : 'Transcription failed.', pendingFiles, mode);
  } finally {
    updateTranscribeState(mode);
  }
}

function showTranscriptionFallback(message: string, filesForPrompt = transcriptionFiles, mode: RecordingMode = 'initial'): void {
  const fileNames = filesForPrompt.map((file, index) => `${index + 1}. ${file.name}`).join('\n');
  const prompt = `Please transcribe these interview audio chunks in order. Preserve speaker labels where possible. After transcription, combine the chunks into one clean transcript. Do not summarize yet.\n\nFiles:\n${fileNames}`;
  const targetHelper = mode === 'followup' ? followupTranscriptionHelper : transcriptionHelper;

  targetHelper.classList.remove('hidden');
  targetHelper.innerHTML = `
    <strong>Automated transcription was not completed</strong>
    <pre class="error-details">${escapeHtml(message)}</pre>
    <p>Fallback: use the uploaded audio files with Gemini or another transcription tool, then paste the combined transcript below.</p>
    <ol>
      <li>Open your transcription tool.</li>
      <li>Upload the audio chunks in order.</li>
      <li>Use this prompt:</li>
    </ol>
    <pre>${escapeHtml(prompt)}</pre>
    <div class="helper-actions">
      <button class="ghost copy-transcription-prompt" type="button">Copy Prompt</button>
      <a class="button-link" href="https://gemini.google.com/app" target="_blank" rel="noreferrer">Open Gemini</a>
    </div>
  `;

  targetHelper.querySelector<HTMLButtonElement>('.copy-transcription-prompt')?.addEventListener('click', async () => {
    await navigator.clipboard.writeText(prompt);
  });
}

function syncTranscriptFromEditor(): void {
  transcript.value = transcriptEditor.innerText.trim();
  transcriptEditor.classList.toggle('is-empty', !transcript.value);
  updateGeneratorState();
}

function syncFollowupTranscriptFromEditor(): void {
  followupTranscript.value = followupTranscriptEditor.innerText.trim();
  followupTranscriptEditor.classList.toggle('is-empty', !followupTranscript.value);
  updateGeneratorState();
}

function setTranscriptValue(value: string, mode: RecordingMode = 'initial'): void {
  const targetTranscript = mode === 'followup' ? followupTranscript : transcript;
  targetTranscript.value = value;
  renderTranscriptEditor(value, mode);
  updateGeneratorState();
}

function renderTranscriptEditor(value: string, mode: RecordingMode = 'initial'): void {
  const targetEditor = mode === 'followup' ? followupTranscriptEditor : transcriptEditor;
  const trimmed = value.trim();
  targetEditor.classList.toggle('is-empty', !trimmed);
  targetEditor.innerHTML = trimmed ? formatTranscriptHtml(trimmed) : '';
}

function formatTranscriptHtml(value: string): string {
  return value
    .split('\n')
    .map((line) => line.trim())
    .map((line) => {
      if (!line) {
        return '<div class="transcript-gap"></div>';
      }

      const match = line.match(/^([^:\n]{1,48}):\s*(.*)$/);
      if (!match) {
        return `<div>${escapeHtml(line)}</div>`;
      }

      return `<div><strong class="speaker-label">${escapeHtml(match[1])}:</strong> ${escapeHtml(match[2])}</div>`;
    })
    .join('');
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      const result = String(reader.result || '');
      resolve(result.includes(',') ? result.split(',')[1] : result);
    });
    reader.addEventListener('error', () => reject(new Error('Could not read audio file.')));
    reader.readAsDataURL(blob);
  });
}

function normalizeAudioMimeType(rawMimeType: string, fileName: string): string {
  const mimeType = rawMimeType.toLowerCase().split(';')[0].trim();
  if (mimeType === 'application/ogg' || mimeType === 'video/ogg') {
    return 'audio/ogg';
  }
  if (mimeType.startsWith('audio/')) {
    return mimeType;
  }
  return inferMimeType(fileName);
}

function inferMimeType(fileName: string): string {
  const lowerName = fileName.toLowerCase();
  if (lowerName.endsWith('.mp3')) return 'audio/mp3';
  if (lowerName.endsWith('.wav')) return 'audio/wav';
  if (lowerName.endsWith('.ogg') || lowerName.endsWith('.oga') || lowerName.endsWith('.ogx')) return 'audio/ogg';
  if (lowerName.endsWith('.flac')) return 'audio/flac';
  if (lowerName.endsWith('.aac')) return 'audio/aac';
  if (lowerName.endsWith('.m4a')) return 'audio/aac';
  return 'audio/webm';
}

function updateGeneratorState(): void {
  const hasTranscript = transcript.value.trim().length > 40;
  const hasFollowupTranscript = followupTranscript.value.trim().length > 40;
  generateResumeButton.disabled = !hasTranscript;
  generateProfileButton.disabled = !hasTranscript;
  regenerateResumeButton.disabled = !hasTranscript || !hasFollowupTranscript;
  regenerateProfileButton.disabled = !lastUpdatedResumeMarkdown.trim();
  updateExportState();
}

function updateExportState(): void {
  const hasResume = lastResumeMarkdown.trim().length > 0;
  const hasProfile = lastProfileSignals.length > 0 || lastProfileMarkdown.trim().length > 0;
  const hasUpdatedResume = lastUpdatedResumeMarkdown.trim().length > 0;
  const hasUpdatedProfile = lastUpdatedProfileMarkdown.trim().length > 0;

  downloadResumeButton.disabled = !hasResume;
  downloadProfileButton.disabled = !hasProfile;
  saveUpdatedResumePdfButton.disabled = !hasUpdatedResume;
  downloadUpdatedResumeButton.disabled = !hasUpdatedResume;
  downloadUpdatedProfileButton.disabled = !hasUpdatedProfile;
  copyUpdatedResumeButton.disabled = !hasUpdatedResume;
}

function startNewSession(): void {
  window.location.reload();
}

async function generateArtifacts(mode: GenerationMode): Promise<void> {
  const rawTranscript = transcript.value.trim();
  if (rawTranscript.length <= 40) {
    return;
  }

  setGenerationBusy(mode, true);
  if (mode === 'resume') {
    renderDocumentOutput(resumeOutput, 'Generating resume...', EMPTY_RESUME_TEXT);
  } else {
    profileOutput.className = 'profile-empty';
    profileOutput.textContent = 'Generating skill profile...';
    renderFeedbackOutput('Checking missing evidence and follow-up questions...', []);
  }

  try {
    const context = readCandidateContext();
    const response = await fetch('/api/generate-artifacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        candidateName: context.name,
        target: context.target,
        transcript: rawTranscript,
        mode,
      }),
    });

    const result = await response.json();
    if (!response.ok) {
      const detailText = Array.isArray(result.details) && result.details.length
        ? `\n\n${result.details.join('\n')}`
        : '';
      throw new Error(`${result.error || 'Generation failed.'}${detailText}`);
    }

    renderAiArtifacts(result as AiArtifacts, mode);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Generation failed.';
    if (mode === 'resume') {
      lastResumeMarkdown = '';
      renderDocumentOutput(resumeOutput, `AI resume generation failed: ${message}`, EMPTY_RESUME_TEXT);
    } else {
      lastFeedbackText = '';
      profileOutput.className = 'profile-empty';
      profileOutput.textContent = 'AI profile was not generated.';
      renderFeedbackOutput(`Skill profile generation failed: ${message}`, []);
    }
  } finally {
    setGenerationBusy(mode, false);
    updateExportState();
  }
}

function setGenerationBusy(mode: GenerationMode, isBusy: boolean): void {
  if (mode === 'resume') {
    generateResumeButton.disabled = isBusy;
    generateResumeButton.textContent = isBusy ? 'Generating Resume...' : 'Generate Resume';
  } else {
    generateProfileButton.disabled = isBusy;
    generateProfileButton.textContent = isBusy ? 'Generating Skill Profile...' : 'Generate Skill Profile';
  }
}

function renderAiArtifacts(artifacts: AiArtifacts, mode: GenerationMode): void {
  if (mode === 'resume') {
    lastResumeMarkdown = artifacts.resumeMarkdown || '';
    renderDocumentOutput(resumeOutput, lastResumeMarkdown || EMPTY_RESUME_TEXT, EMPTY_RESUME_TEXT);
    copyResumeButton.disabled = !artifacts.resumeMarkdown;
    return;
  }

  renderAiProfile(artifacts.profileCards || []);

  const feedbackParts = [
    artifacts.feedbackMarkdown || '',
    artifacts.followUpQuestions?.length ? 'FOLLOW-UP QUESTIONS' : '',
    ...(artifacts.followUpQuestions || []).map((question) => `- ${question}`),
  ].filter(Boolean);

  lastFeedbackText = feedbackParts.join('\n\n');
  renderFeedbackOutput(artifacts.feedbackMarkdown || EMPTY_FEEDBACK_TEXT, artifacts.followUpQuestions || []);
}

async function regenerateResume(): Promise<void> {
  const initialTranscript = transcript.value.trim();
  const followupText = followupTranscript.value.trim();
  if (initialTranscript.length <= 40 || followupText.length <= 40) {
    return;
  }

  regenerateResumeButton.disabled = true;
  regenerateResumeButton.textContent = 'Re-generating Resume...';
  renderDocumentOutput(updatedResumeOutput, 'Re-generating resume...', EMPTY_RESUME_TEXT);

  try {
    const context = readCandidateContext();
    const response = await fetch('/api/generate-artifacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        candidateName: context.name,
        target: context.target,
        transcript: [
          'INITIAL INTERVIEW TRANSCRIPT',
          initialTranscript,
          '',
          'FOLLOW-UP INTERVIEW TRANSCRIPT',
          followupText,
        ].join('\n'),
        existingResume: lastResumeMarkdown,
        mode: 'resume',
      }),
    });

    const result = await response.json();
    if (!response.ok) {
      const detailText = Array.isArray(result.details) && result.details.length
        ? `\n\n${result.details.join('\n')}`
        : '';
      throw new Error(`${result.error || 'Generation failed.'}${detailText}`);
    }

    lastUpdatedResumeMarkdown = (result as AiArtifacts).resumeMarkdown || '';
    renderDocumentOutput(updatedResumeOutput, lastUpdatedResumeMarkdown || EMPTY_RESUME_TEXT, EMPTY_RESUME_TEXT);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Generation failed.';
    lastUpdatedResumeMarkdown = '';
    renderDocumentOutput(updatedResumeOutput, `AI updated resume generation failed: ${message}`, EMPTY_RESUME_TEXT);
  } finally {
    regenerateResumeButton.textContent = 'Re-generate Resume';
    updateGeneratorState();
    updateExportState();
  }
}

async function regenerateProfile(): Promise<void> {
  if (!lastUpdatedResumeMarkdown.trim()) {
    return;
  }

  regenerateProfileButton.disabled = true;
  regenerateProfileButton.textContent = 'Re-generating Skill Profile...';
  updatedProfileOutput.className = 'profile-empty';
  updatedProfileOutput.textContent = 'Re-generating skill profile...';

  try {
    const context = readCandidateContext();
    const response = await fetch('/api/generate-artifacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        candidateName: context.name,
        target: context.target,
        transcript: [
          'INITIAL INTERVIEW TRANSCRIPT',
          transcript.value.trim(),
          '',
          'FOLLOW-UP INTERVIEW TRANSCRIPT',
          followupTranscript.value.trim(),
          '',
          'UPDATED RESUME DRAFT',
          lastUpdatedResumeMarkdown,
        ].join('\n'),
        existingResume: lastUpdatedResumeMarkdown,
        mode: 'profile',
      }),
    });

    const result = await response.json();
    if (!response.ok) {
      const detailText = Array.isArray(result.details) && result.details.length
        ? `\n\n${result.details.join('\n')}`
        : '';
      throw new Error(`${result.error || 'Generation failed.'}${detailText}`);
    }

    renderAiProfile((result as AiArtifacts).profileCards || [], updatedProfileOutput, true);
  } catch (error) {
    lastUpdatedProfileMarkdown = '';
    updatedProfileOutput.className = 'profile-empty';
    updatedProfileOutput.textContent = `Updated skill profile generation failed: ${error instanceof Error ? error.message : 'Generation failed.'}`;
  } finally {
    regenerateProfileButton.textContent = 'Re-generate Skill Profile';
    updateGeneratorState();
    updateExportState();
  }
}

function renderDocumentOutput(element: HTMLDivElement, markdown: string, emptyText: string): void {
  if (!markdown.trim() || markdown.trim() === emptyText) {
    element.className = 'document-output empty-output';
    element.textContent = emptyText;
    return;
  }

  element.className = 'document-output';
  element.innerHTML = markdownToDocumentHtml(markdown);
}

function markdownToDocumentHtml(markdown: string): string {
  const lines = markdown.split('\n');
  const html: string[] = [];
  let isListOpen = false;
  let hasContent = false;

  const closeList = () => {
    if (isListOpen) {
      html.push('</ul>');
      isListOpen = false;
    }
  };

  lines.forEach((line) => {
    const trimmed = line.trim();

    if (!trimmed) {
      closeList();
      return;
    }

    const bulletMatch = trimmed.match(/^[-*]\s+(.+)/);
    if (bulletMatch) {
      if (!isListOpen) {
        html.push('<ul class="doc-list">');
        isListOpen = true;
      }
      html.push(`<li>${formatInlineMarkdown(bulletMatch[1])}</li>`);
      hasContent = true;
      return;
    }

    closeList();

    const headingMatch = trimmed.match(/^(#{1,3})\s+(.+)/);
    if (headingMatch) {
      const levelClass = headingMatch[1].length === 1 ? 'doc-title' : 'doc-section-title';
      html.push(`<h3 class="${levelClass}">${formatInlineMarkdown(headingMatch[2])}</h3>`);
      hasContent = true;
      return;
    }

    if (!hasContent) {
      html.push(`<h3 class="doc-title">${formatInlineMarkdown(trimmed)}</h3>`);
    } else if (isPlainSectionHeading(trimmed)) {
      html.push(`<h3 class="doc-section-title">${formatInlineMarkdown(trimmed)}</h3>`);
    } else {
      html.push(`<p>${formatInlineMarkdown(trimmed)}</p>`);
    }
    hasContent = true;
  });

  closeList();
  return html.join('');
}

function renderFeedbackOutput(feedbackMarkdown: string, questions: string[]): void {
  const hasFeedback = feedbackMarkdown.trim() && feedbackMarkdown.trim() !== EMPTY_FEEDBACK_TEXT;
  const hasQuestions = questions.length > 0;

  if (!hasFeedback && !hasQuestions) {
    feedbackOutput.className = 'feedback-stack empty-output';
    feedbackOutput.textContent = EMPTY_FEEDBACK_TEXT;
    return;
  }

  feedbackOutput.className = 'feedback-stack';
  const feedbackCards = feedbackMarkdown
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^follow-up questions$/i.test(line))
    .map((line) => line.replace(/^[-*]\s+/, ''))
    .map((line) => `<div class="feedback-card">${formatInlineMarkdown(line)}</div>`)
    .join('');

  const questionItems = questions
    .map((question, index) => `
      <li class="question-item">
        <span>${index + 1}</span>
        <p>${formatInlineMarkdown(question)}</p>
      </li>
    `)
    .join('');

  feedbackOutput.innerHTML = `
    ${feedbackCards || '<div class="feedback-card">Review the transcript for missing evidence before finalizing the resume.</div>'}
    ${
      questionItems
        ? `<div class="question-block"><h3>Follow-up questions</h3><ol>${questionItems}</ol></div>`
        : ''
    }
  `;
}

function isPlainSectionHeading(value: string): boolean {
  return (
    value.length <= 56 &&
    value === value.toUpperCase() &&
    /[A-Z]/.test(value) &&
    !/[.!?]$/.test(value)
  );
}

function formatInlineMarkdown(value: string): string {
  return escapeHtml(value)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>');
}

function renderAiProfile(cards: AiProfileCard[], targetOutput = profileOutput, isUpdated = false): void {
  const profileMarkdown = buildAiProfileMarkdown(cards);
  if (isUpdated) {
    lastUpdatedProfileMarkdown = profileMarkdown;
  } else {
    lastProfileSignals = [];
    lastProfileMarkdown = profileMarkdown;
  }

  if (!cards.length) {
    targetOutput.className = 'profile-empty';
    targetOutput.textContent = 'No profile cards were generated.';
    return;
  }

  targetOutput.className = 'profile-grid';
  targetOutput.innerHTML = `
    <div class="ai-evaluation-note">
      <strong>AI evaluation note:</strong>
      These percentages are AI estimates of how strongly the transcript supports each skill area. They are not hard-coded scores, psychometric measurements, or a deterministic assessment instrument. Review the listed evidence and gaps before using them.
    </div>
    ${cards
    .map(
      (card) => `
        <div class="skill-card">
          <div class="skill-topline">
            <strong>${escapeHtml(card.label)}</strong>
            <span>${Math.max(0, Math.min(100, card.evidenceStrength || 0))}% AI evidence estimate</span>
          </div>
          <div class="meter"><span style="width: ${Math.max(8, Math.min(100, card.evidenceStrength || 0))}%"></span></div>
          <ul>
            ${(card.evidence || []).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
            ${card.gap ? `<li><strong>Gap:</strong> ${escapeHtml(card.gap)}</li>` : ''}
          </ul>
        </div>
      `,
    )
    .join('')}
  `;
}

function readCandidateContext(): CandidateContext {
  return {
    name: applicantNameInput.value.trim(),
    target: JOB_DESCRIPTION_CONTEXT,
  };
}

function buildResume(rawTranscript: string, context: CandidateContext): string {
  const text = normalize(rawTranscript);
  const name = context.name || inferName(rawTranscript);
  const skills = extractSignals(text, skillKeywords).slice(0, 8);
  const interests = extractSignals(text, interestKeywords).slice(0, 5);
  const evidence = extractEvidenceSentences(text).slice(0, 6);
  const fitSignals = extractRoleFitSignals(text, context.target).slice(0, 4);

  return [
    name.toUpperCase(),
    ...(context.target ? ['', 'TARGET ROLE / TASK', context.target] : []),
    '',
    'PROFESSIONAL SUMMARY',
    `Emerging candidate with interview evidence showing ${joinList(skills.map((item) => item.label.toLowerCase()).slice(0, 4), 'and') || 'adaptability, communication, and learning orientation'}. Interested in ${joinList(interests.map((item) => item.label.toLowerCase()).slice(0, 3), 'and') || 'roles where learning, contribution, and practical problem-solving matter'}.${context.target ? ` Fit should be reviewed against the target role or task above.` : ''}`,
    '',
    'CORE SKILLS',
    ...(skills.length ? skills.map((item) => `- ${item.label}`) : ['- Communication', '- Learning Agility', '- Problem Solving']),
    ...(fitSignals.length
      ? [
          '',
          'ROLE / TASK FIT',
          ...fitSignals.map((item) => `- ${item.label}: ${item.evidence[0]}`),
        ]
      : []),
    '',
    'INTEREST AREAS',
    ...(interests.length ? interests.map((item) => `- ${item.label}`) : ['- Role fit to be refined from transcript evidence']),
    '',
    'EVIDENCE-BACKED HIGHLIGHTS',
    ...(evidence.length ? evidence.map((item) => `- ${item}`) : ['- Add more transcript detail to generate stronger evidence-backed highlights.']),
    '',
    'DEVELOPMENT AREAS',
    '- Confirm measurable achievements and project outcomes.',
    '- Add specific tools, technologies, or responsibilities mentioned by the candidate.',
    ...(context.target ? ['- Compare each resume claim against the target role/task requirements before final use.'] : ['- Add a target job or task to refine fit and gap analysis.']),
    '- Review transcript for gaps before final submission.',
  ].join('\n');
}

function analyzeTranscript(rawTranscript: string, context: CandidateContext): SkillSignal[] {
  const text = normalize(rawTranscript);
  const strengths = extractSignals(text, skillKeywords).slice(0, 5);
  const interests = extractSignals(text, interestKeywords).slice(0, 3);
  const fitSignals = extractRoleFitSignals(text, context.target).slice(0, 3);
  const gaps = extractGaps(text, context.target);

  const signals = [...fitSignals, ...strengths, ...interests];
  if (!signals.length) {
    signals.push(
      { label: 'Communication', score: 48, evidence: ['Transcript is present, but needs clearer evidence for specific strengths.'] },
      { label: 'Evidence Detail', score: 35, evidence: ['Add concrete projects, results, tools, and responsibilities.'] },
    );
  }

  gaps.forEach((gap) => signals.push(gap));
  return signals.slice(0, 8);
}

function renderSkillProfile(signals: SkillSignal[]): void {
  lastProfileSignals = signals;
  profileOutput.className = 'profile-grid';
  profileOutput.innerHTML = signals
    .map(
      (signal) => `
        <div class="skill-card">
          <div class="skill-topline">
            <strong>${escapeHtml(signal.label)}</strong>
            <span>${signal.score}% evidence</span>
          </div>
          <div class="meter"><span style="width: ${Math.max(8, signal.score)}%"></span></div>
          <ul>
            ${signal.evidence.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
          </ul>
        </div>
      `,
    )
    .join('');
}

function downloadResume(): void {
  const content = lastResumeMarkdown;
  if (!content.trim() || content.trim() === EMPTY_RESUME_TEXT) {
    return;
  }
  downloadTextFile(content, `resume_${sessionSlug()}.md`, 'text/markdown');
}

function downloadUpdatedResume(): void {
  const content = lastUpdatedResumeMarkdown;
  if (!content.trim() || content.trim() === EMPTY_RESUME_TEXT) {
    return;
  }
  downloadTextFile(content, `resume_${sessionSlug()}.md`, 'text/markdown');
}

function downloadProfile(): void {
  const content = lastProfileMarkdown || buildProfileMarkdown(lastProfileSignals);
  if (!content.trim()) {
    return;
  }
  downloadTextFile(content, `${sessionSlug()}-skill-profile.md`, 'text/markdown');
}

function downloadUpdatedProfile(): void {
  const content = lastUpdatedProfileMarkdown;
  if (!content.trim()) {
    return;
  }
  downloadTextFile(content, `${sessionSlug()}-updated-skill-profile.md`, 'text/markdown');
}

function saveResumeAsPdf(content = lastUpdatedResumeMarkdown): void {
  if (!content.trim()) {
    return;
  }

  const filename = `resume_${sessionSlug()}.pdf`;
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    setRecordingState('Popup was blocked. Allow popups to save PDF.', false);
    return;
  }

  printWindow.document.open();
  printWindow.document.write(`
    <!doctype html>
    <html>
      <head>
        <meta charset="UTF-8" />
        <title>${escapeHtml(filename)}</title>
        <style>
          body {
            margin: 32px;
            color: #17212b;
            font-family: Arial, sans-serif;
            line-height: 1.5;
          }
          h3 {
            margin: 20px 0 8px;
          }
          .doc-title {
            font-size: 24px;
            margin-top: 0;
          }
          .doc-section-title {
            border-bottom: 1px solid #94a3b8;
            font-size: 14px;
            letter-spacing: 0.04em;
            text-transform: uppercase;
          }
          p {
            margin: 8px 0;
          }
          li {
            margin: 6px 0;
          }
        </style>
      </head>
      <body>
        ${markdownToDocumentHtml(content)}
        <script>
          window.addEventListener('load', function () {
            document.title = ${JSON.stringify(filename)};
            window.print();
          });
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
}

function buildAiProfileMarkdown(cards: AiProfileCard[]): string {
  if (!cards.length) {
    return '';
  }

  return [
    '# Skill Profile',
    '',
    ...cards.flatMap((card) => [
      `## ${card.label}`,
      '',
      `Evidence strength: ${card.evidenceStrength || 0}%`,
      '',
      ...(card.evidence || []).map((item) => `- ${item}`),
      ...(card.gap ? [`- Gap: ${card.gap}`] : []),
      '',
    ]),
  ].join('\n');
}

function buildProfileMarkdown(signals: SkillSignal[]): string {
  return [
    '# Skill Profile',
    '',
    ...signals.flatMap((signal) => [
      `## ${signal.label}`,
      '',
      `Evidence strength: ${signal.score}%`,
      '',
      ...signal.evidence.map((item) => `- ${item}`),
      '',
    ]),
  ].join('\n');
}

function downloadTextFile(content: string, filename: string, type: string): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function sessionSlug(): string {
  const rawName = applicantNameInput.value.trim() || inferName(transcript.value);
  return rawName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'applicant';
}

function extractSignals(text: string, dictionary: Record<string, string[]>): SkillSignal[] {
  return Object.entries(dictionary)
    .map(([label, terms]) => {
      const matches = terms.filter((term) => text.includes(term.toLowerCase()));
      return {
        label,
        score: Math.min(95, 25 + matches.length * 18),
        evidence: matches.length ? findEvidenceForTerms(text, matches).slice(0, 2) : [],
      };
    })
    .filter((signal) => signal.evidence.length > 0)
    .sort((a, b) => b.score - a.score);
}

function extractRoleFitSignals(text: string, rawTarget: string): SkillSignal[] {
  const target = normalize(rawTarget);
  if (!target) {
    return [];
  }

  return Object.entries(skillKeywords)
    .map(([label, terms]) => {
      const requiredTerms = terms.filter((term) => target.includes(term.toLowerCase()));
      const evidenceTermsForSkill = requiredTerms.filter((term) => text.includes(term.toLowerCase()));
      return {
        label: `Fit: ${label}`,
        score: Math.min(95, 35 + evidenceTermsForSkill.length * 20),
        evidence: evidenceTermsForSkill.length
          ? findEvidenceForTerms(text, evidenceTermsForSkill).slice(0, 2)
          : requiredTerms.length
            ? [`Target mentions ${label.toLowerCase()}, but the transcript needs clearer supporting evidence.`]
            : [],
      };
    })
    .filter((signal) => signal.evidence.length > 0)
    .sort((a, b) => b.score - a.score);
}

function extractEvidenceSentences(text: string): string[] {
  return splitSentences(text).filter((sentence) => {
    const lower = sentence.toLowerCase();
    return evidenceTerms.some((term) => lower.includes(term));
  });
}

function extractGaps(text: string, rawTarget = ''): SkillSignal[] {
  const gaps: SkillSignal[] = [];
  const target = normalize(rawTarget);
  const measurableTerms = ['percent', '%', 'increased', 'reduced', 'improved', 'measured', 'metric'];
  const toolTerms = ['javascript', 'python', 'react', 'sql', 'figma', 'excel', 'api', 'database'];

  if (!measurableTerms.some((term) => text.includes(term))) {
    gaps.push({
      label: 'Measurable Results Gap',
      score: 32,
      evidence: ['Transcript has limited measurable outcomes. Add numbers, project impact, or before/after results.'],
    });
  }

  if (!toolTerms.some((term) => text.includes(term))) {
    gaps.push({
      label: 'Tooling Evidence Gap',
      score: 28,
      evidence: ['Transcript has limited tool or technology evidence. Add concrete tools used by the candidate.'],
    });
  }

  if (target) {
    const missingFit = Object.values(skillKeywords)
      .flat()
      .filter((term) => target.includes(term.toLowerCase()) && !text.includes(term.toLowerCase()))
      .slice(0, 4);

    if (missingFit.length) {
      gaps.push({
        label: 'Role Fit Evidence Gap',
        score: 30,
        evidence: [`Target context suggests ${joinList(missingFit, 'and')}; ask for interview evidence before claiming this fit.`],
      });
    }
  }

  return gaps;
}

function findEvidenceForTerms(text: string, terms: string[]): string[] {
  const sentences = splitSentences(text);
  return sentences.filter((sentence) => {
    const lower = sentence.toLowerCase();
    return terms.some((term) => lower.includes(term));
  });
}

function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function inferName(text: string): string {
  const nameMatch = text.match(/\b(?:my name is|i am|i'm)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})/);
  return nameMatch?.[1] || 'Candidate Name';
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function formatDuration(totalSeconds: number): string {
  const safeSeconds = Math.max(0, totalSeconds);
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function joinList(values: string[], finalJoiner: string): string {
  if (values.length <= 1) {
    return values[0] || '';
  }
  return `${values.slice(0, -1).join(', ')} ${finalJoiner} ${values[values.length - 1]}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function copyResume(): Promise<void> {
  const content = lastResumeMarkdown || resumeOutput.textContent || '';
  if (!content.trim()) {
    return;
  }
  await navigator.clipboard.writeText(content);
  copyResumeButton.textContent = 'Copied';
  window.setTimeout(() => {
    copyResumeButton.textContent = 'Copy';
  }, 1600);
}

async function copyUpdatedResume(): Promise<void> {
  const content = lastUpdatedResumeMarkdown || updatedResumeOutput.textContent || '';
  if (!content.trim()) {
    return;
  }
  await navigator.clipboard.writeText(content);
  copyUpdatedResumeButton.textContent = 'Copied';
  window.setTimeout(() => {
    copyUpdatedResumeButton.textContent = 'Copy';
  }, 1600);
}

function loadSampleTranscript(): void {
  recruiterNameInput.value = 'Recruiter';
  applicantNameInput.value = 'Daniel';
  setTranscriptValue(`Interviewer: Tell me about yourself.
Candidate: My name is Daniel. I enjoy building practical tools that help people work more clearly. I used Python and JavaScript for school projects, and I like explaining technical ideas to classmates.
Interviewer: What are your strengths?
Candidate: I am strong at communication, problem solving, and learning quickly. In one project I improved the workflow by organizing the data and writing clearer documentation.
Interviewer: What kind of roles interest you?
Candidate: I am interested in software development, AI-assisted tools, and education technology because I enjoy helping people understand complicated ideas.
Interviewer: What should you improve?
Candidate: I need to collect more measurable results and describe my project impact with clearer numbers.`);
}

const skillKeywords: Record<string, string[]> = {
  Communication: ['communication', 'explain', 'presentation', 'documentation', 'teach', 'classmates'],
  'Problem Solving': ['problem solving', 'debug', 'fix', 'organize', 'workflow', 'improved'],
  'Technical Building': ['build', 'software', 'javascript', 'python', 'api', 'database', 'web'],
  'Learning Agility': ['learning', 'learn quickly', 'adapt', 'new tools', 'curious'],
  Collaboration: ['team', 'collaborate', 'classmates', 'support', 'helping people'],
  'AI Literacy': ['ai', 'chatgpt', 'gemini', 'codex', 'ai-assisted'],
};

const interestKeywords: Record<string, string[]> = {
  'Software Development': ['software development', 'web', 'app', 'frontend', 'backend'],
  'AI-assisted Tools': ['ai-assisted', 'ai tools', 'chatgpt', 'gemini', 'codex'],
  'Education Technology': ['education', 'teaching', 'classmates', 'workshop', 'facilitate'],
  'Data and Workflow': ['data', 'workflow', 'organizing', 'analytics'],
};

const evidenceTerms = [
  'built',
  'created',
  'improved',
  'organized',
  'used',
  'led',
  'helped',
  'explained',
  'documented',
  'debugged',
  'designed',
];
