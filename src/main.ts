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
  resumeLatex?: string;
  candidateProfileMarkdown?: string;
  profileCards?: AiProfileCard[];
  feedbackMarkdown?: string;
  followUpQuestions?: string[];
};

type JobUrlExtraction = {
  status: 'ok' | 'restricted' | 'not_job';
  company?: string;
  jobDescription?: string;
  error?: string;
};

type InterviewQuestionGeneration = {
  questions?: string[];
  error?: string;
};

type GenerationMode = 'resume' | 'profile' | 'candidate';
type RecordingMode = 'initial' | 'followup';
type ContextMode = 'preset' | 'custom';
type QuestionMode = 'preset' | 'custom' | 'cut_to_chase';
type JobImportSource = 'url' | 'document';

const MAX_SECONDS = 10 * 60;
const EMPTY_RESUME_TEXT = 'Paste a transcript to generate a resume draft.';
const EMPTY_PROFILE_TEXT = 'Generate a skill profile to see quick evidence-strength cards.';
const EMPTY_CANDIDATE_PROFILE_TEXT = 'Generate a candidate profile to see task fit, relevant strengths, evidence, and gaps.';
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
  'Tell me about the relevant qualifications, training or 42 experience you have for his junior developer role and how long you have been developing these skills.',
  'Choose one completed project that best fits this role. What did you personally build, what problem did it solve, and what result or working feature came out of it?',
  'What concrete front-end, back-end, or scripting work have you done with HTML, CSS, JavaScript, React, Vue, PHP, Python, or similar tools? Give examples from real projects.',
  'How have you used Git, debugging, testing, or validation to make sure your work was correct and ready to share?',
  'Tell me about a time you worked independently, handled a deadline, fixed a small urgent issue, or communicated progress/blockers to teammates or clients.',
  'What parts of this StartupDigital Services mission fit your strengths, and what would you most want to learn or improve during the project?',
];
const CUT_TO_CHASE_QUESTIONS = [
  'I trust you have shown interest by researching more on our company and JD. Give us 3 strong reasons to hire you.',
  'What are 2 promises you can make for what you can commit to us if you are hired?',
  'What is one question you have that can show us what you value?',
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
let lastCandidateProfileMarkdown = '';
let lastResumeMarkdown = '';
let lastUpdatedProfileMarkdown = '';
let lastUpdatedCandidateProfileMarkdown = '';
let lastUpdatedResumeMarkdown = '';
let lastFeedbackText = '';
let audioContext: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let waveformAnimationId: number | null = null;
let selectedAudioDeviceId = '';
let micTestStream: MediaStream | null = null;
let isMicTesting = false;
let activeContextMode: ContextMode = 'preset';
let latestJobImportSource: JobImportSource = 'url';
let selectedJobDocument: File | null = null;
let selectedApplicantDocument: File | null = null;

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('App root was not found.');
}

const DOWNLOAD_ICON_HTML = `
  <svg class="download-glyph" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 3v12"></path>
    <path d="m7 10 5 5 5-5"></path>
    <path d="M5 15v5h14v-5"></path>
  </svg>
`;

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
          <canvas class="waveform" id="waveform" width="640" height="120" aria-label="Live microphone waveform"></canvas>
        </div>

        <section class="question-guide">
          <h3>Suggested interview questions</h3>
          <div class="context-mode-switch question-mode-switch" role="group" aria-label="Question type">
            <button class="context-mode-button is-active" id="questions-preset" type="button">42_Collaborative_resume</button>
            <button class="context-mode-button" id="questions-custom" type="button">Custom</button>
          </div>
          <ol id="preset-question-list" start="0">
            ${INTERVIEW_QUESTIONS.map((question) => `<li>${escapeHtml(question)}</li>`).join('')}
          </ol>
          <div class="custom-question-panel hidden" id="custom-question-panel">
            <div class="custom-question-actions">
              <button class="secondary" id="generate-custom-questions" type="button">Generate</button>
              <button class="cut-to-chase-button" id="questions-cut-to-chase" type="button">Cut to the Chase</button>
              <p class="question-generation-status" id="question-generation-status" role="status"></p>
            </div>
            <textarea
              class="question-custom-input"
              id="custom-questions"
              rows="8"
              placeholder="Questions to find out more about applicant's experiences and expertise."
            ></textarea>
          </div>
        </section>

        <div class="recording-list" id="recording-list"></div>
        <div class="transcription-helper hidden" id="recording-transcription-helper"></div>
      </aside>

      <section class="panel transcript-panel">
        <div class="panel-heading">
          <div>
            <h2>APPLICANT INFORMATION</h2>
          </div>
          <div class="panel-actions">
            <button class="ghost" id="load-sample" type="button">Load Sample</button>
          </div>
        </div>

        <section class="applicant-direct-section">
          <div class="applicant-direct-form" aria-label="Applicant direct information">
            <fieldset>
              <legend>Contact</legend>
              <label>
                <span>Name</span>
                <input class="applicant-direct-field" id="applicant-info-name" data-label="Name" type="text" placeholder="Candidate name" />
              </label>
              <label>
                <span>Email</span>
                <input class="applicant-direct-field" data-label="Email" type="email" placeholder="name@email.com" />
              </label>
              <label>
                <span>Phone</span>
                <input class="applicant-direct-field" data-label="Phone" type="tel" placeholder="+65 9000 0000" />
              </label>
              <label>
                <span>Location</span>
                <input class="applicant-direct-field" data-label="Location" type="text" placeholder="Singapore" />
              </label>
              <label>
                <span>LinkedIn</span>
                <input class="applicant-direct-field" data-label="LinkedIn" type="url" placeholder="https://linkedin.com/in/..." />
              </label>
              <label>
                <span>GitHub</span>
                <input class="applicant-direct-field" data-label="GitHub" type="url" placeholder="https://github.com/..." />
              </label>
              <label>
                <span>Portfolio</span>
                <input class="applicant-direct-field" data-label="Portfolio" type="url" placeholder="https://..." />
              </label>
            </fieldset>

            <fieldset>
              <legend>Resume sections</legend>
              <label>
                <span>Education</span>
                <textarea class="applicant-direct-field compact-field" data-label="Education" rows="3" placeholder="42 Singapore - Computer Programming - Sep 2023 to Sep 2025"></textarea>
              </label>
              <label>
                <span>Certifications</span>
                <textarea class="applicant-direct-field compact-field" data-label="Certifications" rows="3" placeholder="Certificate name - issuer - year"></textarea>
              </label>
              <label>
                <span>Technical skills</span>
                <textarea class="applicant-direct-field compact-field" data-label="Technical skills" rows="4" placeholder="Languages: Python, C, SQL&#10;Tools: Git, Docker, Linux"></textarea>
              </label>
            </fieldset>
          </div>
        </section>

        <div class="drop-zone compact-drop-zone" id="drop-zone">
          <input id="file-input" type="file" accept="audio/*,.ogg,.oga,.ogx,.opus,.webm,.m4a,.mp3,.wav,.aac,.flac" multiple />
          <p>Drop audio files for transcription</p>
          <div class="transcription-file-list" id="transcription-file-list"></div>
          <button class="secondary drop-transcribe-button" id="transcribe-files" type="button" disabled>Transcribe</button>
        </div>

        <div class="transcription-helper hidden" id="transcription-helper"></div>

        <section class="applicant-transcript-section">
          <div class="section-title-row">
            <h3 class="transcription-title">Transcription</h3>
            <button class="title-download-button" id="download-transcript" type="button" aria-label="Download transcript" data-tooltip="Download transcript" disabled>
              ${DOWNLOAD_ICON_HTML}
            </button>
          </div>
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

        <section class="additional-info-section">
          <h3 class="transcription-title">Additional information</h3>
          <label class="applicant-document-upload">
            <input
              id="applicant-document-input"
              type="file"
              accept=".txt,.md,.markdown,.html,.htm,.csv,.json,.doc,.docx,.pdf,text/*"
            />
            <span>Upload additional applicant documentation</span>
          </label>
          <span class="applicant-document-name" id="applicant-document-name"></span>
          <p class="applicant-document-status" id="applicant-document-status" role="status"></p>
          <textarea
            class="applicant-direct-field"
            id="additional-info"
            data-label="Other notes from uploaded doc"
            rows="10"
            placeholder="Other notes from uploaded documentation or applicant. Use this for exact dates, awards, project links, or anything that does not fit above."
          ></textarea>
        </section>
      </section>
    </section>

    <section class="outputs">
      <article class="panel resume-output">
        <div class="panel-heading">
          <div>
            <h2>
              <span class="section-icon" aria-hidden="true">👔</span>
              RESUME
              <button class="title-download-button" id="download-resume" type="button" aria-label="Download resume PDF" data-tooltip="Download resume PDF" disabled>
                ${DOWNLOAD_ICON_HTML}
              </button>
            </h2>
          </div>
          <div class="panel-actions">
            <button class="primary" id="generate-resume" type="button" disabled>Generate Resume</button>
            <button class="ghost" id="copy-resume" type="button" disabled>Copy</button>
          </div>
        </div>
        <div id="resume-output" class="document-output empty-output">${EMPTY_RESUME_TEXT}</div>
      </article>

      <article class="panel profile-output">
        <div class="panel-heading">
          <div>
            <h2>
              <span class="section-icon" aria-hidden="true">★</span>
              SKILL PROFILE
              <button class="title-download-button" id="download-profile" type="button" aria-label="Download skill profile" data-tooltip="Download skill profile" disabled>
                ${DOWNLOAD_ICON_HTML}
              </button>
            </h2>
          </div>
          <button class="secondary" id="generate-profile" type="button" disabled>Generate Skill Profile</button>
        </div>
        <div id="profile-output" class="profile-empty">${EMPTY_PROFILE_TEXT}</div>
      </article>

      <article class="panel candidate-profile-output">
        <div class="panel-heading">
          <div>
            <h2>
              <span class="section-icon" aria-hidden="true">◆</span>
              CANDIDATE PROFILE
              <button class="title-download-button" id="download-candidate-profile" type="button" aria-label="Download candidate profile" data-tooltip="Download candidate profile" disabled>
                ${DOWNLOAD_ICON_HTML}
              </button>
            </h2>
          </div>
          <button class="secondary" id="generate-candidate-profile" type="button" disabled>Generate Candidate Profile</button>
        </div>
        <div id="candidate-profile-output" class="document-output empty-output">${EMPTY_CANDIDATE_PROFILE_TEXT}</div>
      </article>

      <article class="panel feedback-output">
        <div class="panel-heading">
          <div>
            <h2>
              <span class="section-icon" aria-hidden="true">💬</span>
              INTERVIEW FEEDBACK
              <button class="title-download-button" id="download-feedback" type="button" aria-label="Download feedback" data-tooltip="Download feedback" disabled>
                ${DOWNLOAD_ICON_HTML}
              </button>
            </h2>
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
        <div class="transcription-helper hidden" id="followup-recording-transcription-helper"></div>
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

        <div class="section-title-row">
          <h3 class="transcription-title">Transcription</h3>
          <button class="title-download-button" id="download-followup-transcript" type="button" aria-label="Download follow-up transcript" data-tooltip="Download follow-up transcript" disabled>
            ${DOWNLOAD_ICON_HTML}
          </button>
        </div>
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
            <h2>
              <span class="section-icon" aria-hidden="true">👔</span>
              UPDATED RESUME
              <button class="title-download-button" id="save-updated-resume-pdf" type="button" aria-label="Download updated resume PDF" data-tooltip="Download updated resume PDF" disabled>
                ${DOWNLOAD_ICON_HTML}
              </button>
            </h2>
          </div>
          <div class="panel-actions">
            <button class="primary" id="regenerate-resume" type="button" disabled>Re-generate Resume</button>
            <button class="ghost" id="copy-updated-resume" type="button" disabled>Copy</button>
          </div>
        </div>
        <div id="updated-resume-output" class="document-output empty-output">${EMPTY_RESUME_TEXT}</div>
      </article>

      <article class="panel profile-output">
        <div class="panel-heading">
          <div>
            <h2>
              <span class="section-icon" aria-hidden="true">★</span>
              UPDATED SKILL PROFILE
              <button class="title-download-button" id="download-updated-profile" type="button" aria-label="Download updated skill profile" data-tooltip="Download updated skill profile" disabled>
                ${DOWNLOAD_ICON_HTML}
              </button>
            </h2>
          </div>
          <button class="secondary" id="regenerate-profile" type="button" disabled>Re-generate Skill Profile</button>
        </div>
        <div id="updated-profile-output" class="profile-empty">${EMPTY_PROFILE_TEXT}</div>
      </article>

      <article class="panel candidate-profile-output">
        <div class="panel-heading">
          <div>
            <h2>
              <span class="section-icon" aria-hidden="true">◆</span>
              UPDATED CANDIDATE PROFILE
              <button class="title-download-button" id="download-updated-candidate-profile" type="button" aria-label="Download updated candidate profile" data-tooltip="Download updated candidate profile" disabled>
                ${DOWNLOAD_ICON_HTML}
              </button>
            </h2>
          </div>
          <button class="secondary" id="regenerate-candidate-profile" type="button" disabled>Re-generate Candidate Profile</button>
        </div>
        <div id="updated-candidate-profile-output" class="document-output empty-output">${EMPTY_CANDIDATE_PROFILE_TEXT}</div>
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
const presetContextButton = getElement<HTMLButtonElement>('context-preset');
const customContextButton = getElement<HTMLButtonElement>('context-custom');
const presetContextContent = getElement<HTMLDivElement>('preset-context-content');
const customContextContent = getElement<HTMLDivElement>('custom-context-content');
const jobDocumentInput = getElement<HTMLInputElement>('job-document-input');
const jobDocumentName = getElement<HTMLSpanElement>('job-document-name');
const jobUrlInput = getElement<HTMLInputElement>('job-url-input');
const extractJobButton = getElement<HTMLButtonElement>('extract-job-url');
const jobImportStatus = getElement<HTMLParagraphElement>('job-import-status');
const customCompanyInput = getElement<HTMLTextAreaElement>('custom-company');
const customJobDescriptionInput = getElement<HTMLTextAreaElement>('custom-job-description');
const presetQuestionsButton = getElement<HTMLButtonElement>('questions-preset');
const customQuestionsButton = getElement<HTMLButtonElement>('questions-custom');
const cutToChaseQuestionsButton = getElement<HTMLButtonElement>('questions-cut-to-chase');
const presetQuestionList = getElement<HTMLOListElement>('preset-question-list');
const customQuestionPanel = getElement<HTMLDivElement>('custom-question-panel');
const generateCustomQuestionsButton = getElement<HTMLButtonElement>('generate-custom-questions');
const questionGenerationStatus = getElement<HTMLParagraphElement>('question-generation-status');
const customQuestionsInput = getElement<HTMLTextAreaElement>('custom-questions');
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
const recordingTranscriptionHelper = getElement<HTMLDivElement>('recording-transcription-helper');
const followupRecordingTranscriptionHelper = getElement<HTMLDivElement>('followup-recording-transcription-helper');
const waveform = getElement<HTMLCanvasElement>('waveform');
const followupWaveform = getElement<HTMLCanvasElement>('followup-waveform');
const transcriptionFileList = getElement<HTMLDivElement>('transcription-file-list');
const followupTranscriptionFileList = getElement<HTMLDivElement>('followup-transcription-file-list');
const transcriptionHelper = getElement<HTMLDivElement>('transcription-helper');
const followupTranscriptionHelper = getElement<HTMLDivElement>('followup-transcription-helper');
const transcript = getElement<HTMLTextAreaElement>('transcript');
const transcriptEditor = getElement<HTMLDivElement>('transcript-editor');
const applicantInfoNameInput = getElement<HTMLInputElement>('applicant-info-name');
const applicantDocumentInput = getElement<HTMLInputElement>('applicant-document-input');
const applicantDocumentName = getElement<HTMLSpanElement>('applicant-document-name');
const applicantDocumentStatus = getElement<HTMLParagraphElement>('applicant-document-status');
const additionalInfoInput = getElement<HTMLTextAreaElement>('additional-info');
const followupTranscript = getElement<HTMLTextAreaElement>('followup-transcript');
const followupTranscriptEditor = getElement<HTMLDivElement>('followup-transcript-editor');
const transcribeFilesButton = getElement<HTMLButtonElement>('transcribe-files');
const followupTranscribeFilesButton = getElement<HTMLButtonElement>('followup-transcribe-files');
const generateResumeButton = getElement<HTMLButtonElement>('generate-resume');
const generateProfileButton = getElement<HTMLButtonElement>('generate-profile');
const generateCandidateProfileButton = getElement<HTMLButtonElement>('generate-candidate-profile');
const regenerateResumeButton = getElement<HTMLButtonElement>('regenerate-resume');
const regenerateProfileButton = getElement<HTMLButtonElement>('regenerate-profile');
const regenerateCandidateProfileButton = getElement<HTMLButtonElement>('regenerate-candidate-profile');
const resumeOutput = getElement<HTMLDivElement>('resume-output');
const profileOutput = getElement<HTMLDivElement>('profile-output');
const candidateProfileOutput = getElement<HTMLDivElement>('candidate-profile-output');
const feedbackOutput = getElement<HTMLDivElement>('feedback-output');
const updatedResumeOutput = getElement<HTMLDivElement>('updated-resume-output');
const updatedProfileOutput = getElement<HTMLDivElement>('updated-profile-output');
const updatedCandidateProfileOutput = getElement<HTMLDivElement>('updated-candidate-profile-output');
const copyResumeButton = getElement<HTMLButtonElement>('copy-resume');
const copyUpdatedResumeButton = getElement<HTMLButtonElement>('copy-updated-resume');
const loadSampleButton = getElement<HTMLButtonElement>('load-sample');
const saveUpdatedResumePdfButton = getElement<HTMLButtonElement>('save-updated-resume-pdf');
const downloadResumeButton = getElement<HTMLButtonElement>('download-resume');
const downloadTranscriptButton = getElement<HTMLButtonElement>('download-transcript');
const downloadFeedbackButton = getElement<HTMLButtonElement>('download-feedback');
const downloadProfileButton = getElement<HTMLButtonElement>('download-profile');
const downloadCandidateProfileButton = getElement<HTMLButtonElement>('download-candidate-profile');
const downloadFollowupTranscriptButton = getElement<HTMLButtonElement>('download-followup-transcript');
const downloadUpdatedProfileButton = getElement<HTMLButtonElement>('download-updated-profile');
const downloadUpdatedCandidateProfileButton = getElement<HTMLButtonElement>('download-updated-candidate-profile');
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
additionalInfoInput.addEventListener('input', updateGeneratorState);
document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('.applicant-direct-field').forEach((field) => {
  field.addEventListener('input', updateGeneratorState);
});
applicantInfoNameInput.addEventListener('input', () => {
  applicantNameInput.value = applicantInfoNameInput.value;
  updateGeneratorState();
  clearRecordingValidation();
});
applicantDocumentInput.addEventListener('change', importApplicantDocument);
followupTranscriptEditor.addEventListener('input', syncFollowupTranscriptFromEditor);
applicantNameInput.addEventListener('input', () => {
  applicantInfoNameInput.value = applicantNameInput.value;
  updateGeneratorState();
  clearRecordingValidation();
});
recruiterNameInput.addEventListener('input', clearRecordingValidation);
presetContextButton.addEventListener('click', () => setContextMode('preset'));
customContextButton.addEventListener('click', () => setContextMode('custom'));
jobUrlInput.addEventListener('input', () => {
  latestJobImportSource = 'url';
  jobImportStatus.textContent = '';
  updateJobExtractButtonState();
});
jobDocumentInput.addEventListener('change', () => {
  selectedJobDocument = jobDocumentInput.files?.[0] || null;
  latestJobImportSource = 'document';
  jobDocumentName.textContent = selectedJobDocument ? selectedJobDocument.name : '';
  jobImportStatus.textContent = selectedJobDocument
    ? `Selected document: ${selectedJobDocument.name}`
    : '';
  jobImportStatus.classList.remove('is-error', 'is-success');
  updateJobExtractButtonState();
});
extractJobButton.addEventListener('click', extractLatestJobSource);
customCompanyInput.addEventListener('input', () => {
  updateGeneratorState();
  updateCustomQuestionGeneratorState();
});
customJobDescriptionInput.addEventListener('input', () => {
  updateGeneratorState();
  updateCustomQuestionGeneratorState();
});
presetQuestionsButton.addEventListener('click', () => setQuestionMode('preset'));
customQuestionsButton.addEventListener('click', () => setQuestionMode('custom'));
cutToChaseQuestionsButton.addEventListener('click', () => setQuestionMode('cut_to_chase'));
generateCustomQuestionsButton.addEventListener('click', generateCustomInterviewQuestions);
generateResumeButton.addEventListener('click', () => generateArtifacts('resume'));
generateProfileButton.addEventListener('click', () => generateArtifacts('profile'));
generateCandidateProfileButton.addEventListener('click', () => generateArtifacts('candidate'));
regenerateResumeButton.addEventListener('click', regenerateResume);
regenerateProfileButton.addEventListener('click', regenerateProfile);
regenerateCandidateProfileButton.addEventListener('click', regenerateCandidateProfile);
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
downloadResumeButton.addEventListener('click', () => saveResumeAsPdf(lastResumeMarkdown));
downloadTranscriptButton.addEventListener('click', () => downloadTranscript('initial'));
downloadFeedbackButton.addEventListener('click', downloadFeedback);
downloadProfileButton.addEventListener('click', downloadProfile);
downloadCandidateProfileButton.addEventListener('click', downloadCandidateProfile);
downloadFollowupTranscriptButton.addEventListener('click', () => downloadTranscript('followup'));
downloadUpdatedProfileButton.addEventListener('click', downloadUpdatedProfile);
downloadUpdatedCandidateProfileButton.addEventListener('click', downloadUpdatedCandidateProfile);
newSessionTopButton.addEventListener('click', startNewSession);
newSessionBottomButton.addEventListener('click', startNewSession);
updateCustomQuestionGeneratorState();

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
    <div class="context-mode-switch" role="group" aria-label="Context type">
      <button class="context-mode-button is-active" id="context-preset" type="button">42_Collaborative_resume</button>
      <button class="context-mode-button" id="context-custom" type="button">Custom</button>
    </div>

    <div class="context-copy" id="preset-context-content">
      ${renderPresetContextHtml()}
    </div>

    <div class="custom-context hidden" id="custom-context-content">
      <div class="job-url-import">
        <label class="job-document-upload">
          <input
            id="job-document-input"
            type="file"
            accept=".txt,.md,.markdown,.html,.htm,.csv,.json,.doc,.docx,.pdf,text/*"
          />
          <span>Upload job description doc.</span>
        </label>
        <span class="job-import-or">OR</span>
        <input
          id="job-url-input"
          type="url"
          placeholder="Copy and paste link to job."
          aria-label="Job application URL"
        />
        <button class="secondary" id="extract-job-url" type="button" disabled>Extract</button>
      </div>
      <span class="job-document-name" id="job-document-name"></span>
      <p class="job-import-status" id="job-import-status" role="status"></p>

      <div class="manual-job-fallback" id="manual-job-fallback">
        <label>
          <span><u>Company</u></span>
          <textarea
            id="custom-company"
            rows="5"
            placeholder="Copy and paste the company information here."
          ></textarea>
        </label>

        <label>
          <span><u>Job Description</u></span>
          <textarea
            id="custom-job-description"
            rows="8"
            placeholder="Copy and paste the job description here."
          ></textarea>
        </label>
      </div>
    </div>
  `;
}

function renderPresetContextHtml(): string {
  return `
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
  `;
}

function setContextMode(mode: ContextMode): void {
  activeContextMode = mode;
  const isPreset = mode === 'preset';

  presetContextButton.classList.toggle('is-active', isPreset);
  customContextButton.classList.toggle('is-active', !isPreset);
  presetContextButton.setAttribute('aria-pressed', String(isPreset));
  customContextButton.setAttribute('aria-pressed', String(!isPreset));
  presetContextContent.classList.toggle('hidden', !isPreset);
  customContextContent.classList.toggle('hidden', isPreset);
  updateGeneratorState();
}

function setQuestionMode(mode: QuestionMode): void {
  const isPreset = mode === 'preset';
  const isCustom = mode === 'custom';
  const isCutToChase = mode === 'cut_to_chase';

  presetQuestionsButton.classList.toggle('is-active', isPreset);
  customQuestionsButton.classList.toggle('is-active', isCustom);
  cutToChaseQuestionsButton.classList.toggle('is-active', isCutToChase);
  presetQuestionsButton.setAttribute('aria-pressed', String(isPreset));
  customQuestionsButton.setAttribute('aria-pressed', String(isCustom));
  cutToChaseQuestionsButton.setAttribute('aria-pressed', String(isCutToChase));
  presetQuestionList.classList.toggle('hidden', !isPreset);
  customQuestionPanel.classList.toggle('hidden', isPreset);
  customQuestionPanel.classList.toggle('is-static', isCutToChase);

  if (isCutToChase) {
    customQuestionsInput.value = CUT_TO_CHASE_QUESTIONS
      .map((question, index) => `${index + 1}. ${question}`)
      .join('\n\n');
    questionGenerationStatus.classList.remove('is-error', 'is-success');
    questionGenerationStatus.textContent = '';
  }

  updateCustomQuestionGeneratorState();
}

function updateCustomQuestionGeneratorState(): void {
  const hasCustomContext = customCompanyInput.value.trim().length > 0 ||
    customJobDescriptionInput.value.trim().length > 0;
  generateCustomQuestionsButton.disabled = !hasCustomContext;
}

function updateJobExtractButtonState(): void {
  extractJobButton.disabled = !jobUrlInput.value.trim() && !selectedJobDocument;
}

async function extractLatestJobSource(): Promise<void> {
  if (latestJobImportSource === 'document') {
    await extractJobDocument();
    return;
  }
  await extractJobUrl();
}

async function extractJobUrl(): Promise<void> {
  const url = jobUrlInput.value.trim();
  if (!url) {
    return;
  }

  const startedAt = Date.now();
  let elapsedTimer = 0;
  const updateElapsedStatus = () => {
    jobImportStatus.textContent = `Reading job link... ${formatElapsedTime(startedAt)}`;
  };
  extractJobButton.disabled = true;
  const stopButtonTimer = startButtonTimer(extractJobButton, 'Extracting...');
  jobImportStatus.classList.remove('is-error', 'is-success');
  updateElapsedStatus();
  elapsedTimer = window.setInterval(updateElapsedStatus, 1000);

  try {
    const response = await fetch('/api/extract-job-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    const result = await response.json() as JobUrlExtraction;

    if (!response.ok) {
      throw new Error(result.error || 'Job link extraction failed.');
    }

    if (result.status === 'restricted') {
      jobImportStatus.classList.add('is-error');
      jobImportStatus.textContent = `This page has restrictions which do not allow extraction. Copy and paste the company and job description below. ${formatElapsedTime(startedAt)}`;
      updateGeneratorState();
      updateCustomQuestionGeneratorState();
      return;
    }

    if (result.status === 'not_job') {
      jobImportStatus.classList.add('is-error');
      jobImportStatus.textContent = `This is not a job application page. ${formatElapsedTime(startedAt)}`;
      updateGeneratorState();
      updateCustomQuestionGeneratorState();
      return;
    }

    customCompanyInput.value = result.company || '';
    customJobDescriptionInput.value = result.jobDescription || '';
    jobImportStatus.classList.add('is-success');
    jobImportStatus.textContent = `Job details extracted. Review the company and job description before generating. ${formatElapsedTime(startedAt)}`;
    updateGeneratorState();
    updateCustomQuestionGeneratorState();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Job link extraction failed.';
    jobImportStatus.classList.add('is-error');
    jobImportStatus.textContent = `${message} ${formatElapsedTime(startedAt)}`;
  } finally {
    window.clearInterval(elapsedTimer);
    stopButtonTimer();
    updateJobExtractButtonState();
    extractJobButton.textContent = 'Extract';
  }
}

async function extractJobDocument(): Promise<void> {
  if (!selectedJobDocument) {
    return;
  }

  const startedAt = Date.now();
  let elapsedTimer = 0;
  const updateElapsedStatus = () => {
    jobImportStatus.textContent = `Reading job document... ${formatElapsedTime(startedAt)}`;
  };
  extractJobButton.disabled = true;
  const stopButtonTimer = startButtonTimer(extractJobButton, 'Extracting...');
  jobImportStatus.classList.remove('is-error', 'is-success');
  updateElapsedStatus();
  elapsedTimer = window.setInterval(updateElapsedStatus, 1000);

  try {
    const text = await selectedJobDocument.text();
    const response = await fetch('/api/extract-job-document', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: selectedJobDocument.name,
        mimeType: selectedJobDocument.type,
        text,
      }),
    });
    const result = await response.json() as JobUrlExtraction;

    if (!response.ok) {
      throw new Error(result.error || 'Job document extraction failed.');
    }

    if (result.status === 'restricted') {
      jobImportStatus.classList.add('is-error');
      jobImportStatus.textContent = `This document could not be read for extraction. Copy and paste the company and job description below. ${formatElapsedTime(startedAt)}`;
      return;
    }

    if (result.status === 'not_job') {
      jobImportStatus.classList.add('is-error');
      jobImportStatus.textContent = `This is not a job application page. ${formatElapsedTime(startedAt)}`;
      return;
    }

    customCompanyInput.value = result.company || '';
    customJobDescriptionInput.value = result.jobDescription || '';
    jobImportStatus.classList.add('is-success');
    jobImportStatus.textContent = `Job details extracted from document. Review the company and job description before generating. ${formatElapsedTime(startedAt)}`;
    updateGeneratorState();
    updateCustomQuestionGeneratorState();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Job document extraction failed.';
    jobImportStatus.classList.add('is-error');
    jobImportStatus.textContent = `${message} ${formatElapsedTime(startedAt)}`;
  } finally {
    window.clearInterval(elapsedTimer);
    stopButtonTimer();
    updateJobExtractButtonState();
    extractJobButton.textContent = 'Extract';
  }
}

async function importApplicantDocument(): Promise<void> {
  selectedApplicantDocument = applicantDocumentInput.files?.[0] || null;
  applicantDocumentName.textContent = selectedApplicantDocument ? selectedApplicantDocument.name : '';
  applicantDocumentStatus.classList.remove('is-error', 'is-success');

  if (!selectedApplicantDocument) {
    applicantDocumentStatus.textContent = '';
    return;
  }

  try {
    const text = await selectedApplicantDocument.text();
    if (!text.trim() || looksLikeUnreadableDocumentText(text)) {
      throw new Error('This document could not be read as text. Paste the details below instead.');
    }

    additionalInfoInput.value = text.trim();
    applicantDocumentStatus.classList.add('is-success');
    applicantDocumentStatus.textContent = 'Additional information loaded.';
    updateGeneratorState();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'This document could not be read.';
    applicantDocumentStatus.classList.add('is-error');
    applicantDocumentStatus.textContent = message;
  }
}

function looksLikeUnreadableDocumentText(text: string): boolean {
  const sample = text.slice(0, 2000);
  if (/^%PDF-|^PK\u0003\u0004/.test(sample)) {
    return true;
  }
  const controlCharacters = sample.match(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g) || [];
  return sample.length > 0 && controlCharacters.length / sample.length > 0.02;
}

async function generateCustomInterviewQuestions(): Promise<void> {
  const company = customCompanyInput.value.trim();
  const jobDescription = customJobDescriptionInput.value.trim();

  if (!company && !jobDescription) {
    questionGenerationStatus.classList.add('is-error');
    questionGenerationStatus.textContent = 'Add company or job information first.';
    return;
  }

  const startedAt = Date.now();
  let elapsedTimer = 0;
  const updateElapsedStatus = () => {
    questionGenerationStatus.textContent = `Generating questions... ${formatElapsedTime(startedAt)}`;
  };
  generateCustomQuestionsButton.disabled = true;
  const stopButtonTimer = startButtonTimer(generateCustomQuestionsButton, 'Generating...');
  questionGenerationStatus.classList.remove('is-error', 'is-success');
  updateElapsedStatus();
  elapsedTimer = window.setInterval(updateElapsedStatus, 1000);

  try {
    const response = await fetch('/api/generate-interview-questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ company, jobDescription }),
    });
    const result = await response.json() as InterviewQuestionGeneration;

    if (!response.ok) {
      const detailText = Array.isArray((result as { details?: string[] }).details)
        ? `\n${(result as { details: string[] }).details.join('\n')}`
        : '';
      throw new Error(`${result.error || 'Question generation failed.'}${detailText}`);
    }

    const questions = result.questions || [];
    customQuestionsInput.value = questions.map((question, index) => `${index + 1}. ${question}`).join('\n\n');
    questionGenerationStatus.classList.add('is-success');
    questionGenerationStatus.textContent = `Generated ${questions.length} custom questions. ${formatElapsedTime(startedAt)}`;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Question generation failed.';
    questionGenerationStatus.classList.add('is-error');
    questionGenerationStatus.textContent = `${message} ${formatElapsedTime(startedAt)}`;
  } finally {
    window.clearInterval(elapsedTimer);
    stopButtonTimer();
    generateCustomQuestionsButton.textContent = 'Generate';
    updateCustomQuestionGeneratorState();
  }
}

function formatElapsedTime(startedAt: number): string {
  const seconds = Math.max(0, Math.round((Date.now() - startedAt) / 1000));
  return `(${seconds}s)`;
}

function startButtonTimer(button: HTMLButtonElement, label: string): () => void {
  const startedAt = Date.now();
  const updateLabel = () => {
    button.textContent = `${label} ${formatElapsedTime(startedAt)}`;
  };
  updateLabel();
  const timerId = window.setInterval(updateLabel, 1000);
  return () => window.clearInterval(timerId);
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
            <a class="download-icon" href="${recording.url}" download="${escapeHtml(recording.name)}" aria-label="Download recording ${index + 1}" data-tooltip="Download recording ${index + 1}">${DOWNLOAD_ICON_HTML}</a>
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

  transcribeAudioFiles([recording], mode, button);
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

async function transcribeAudioFiles(
  filesToTranscribe = transcriptionFiles,
  mode: RecordingMode = 'initial',
  actionButton?: HTMLButtonElement,
): Promise<void> {
  const pendingFiles = filesToTranscribe.filter((file) => !file.transcribed);
  if (!pendingFiles.length) {
    return;
  }

  const isRecordedInterviewSource = Boolean(actionButton);
  const targetButton = mode === 'followup' ? followupTranscribeFilesButton : transcribeFilesButton;
  const targetHelper = getTranscriptionHelper(mode, isRecordedInterviewSource);
  const helperTitle = isRecordedInterviewSource ? 'Transcribing recorded interview...' : 'Transcribing uploaded audio...';
  const helperIntro = isRecordedInterviewSource
    ? 'Sending the finished interview recording to transcription providers. Keep this page open.'
    : 'Sending uploaded recordings to transcription providers. Keep this page open.';
  targetButton.disabled = true;
  if (actionButton) {
    actionButton.disabled = true;
  }
  const stopButtonTimer = startButtonTimer(actionButton || targetButton, 'Transcribing...');
  targetHelper.classList.remove('hidden');
  targetHelper.innerHTML = `<strong>${helperTitle}</strong><p>${helperIntro}</p>`;

  try {
    const transcriptChunks: string[] = [];

    for (let index = 0; index < pendingFiles.length; index += 1) {
      const file = pendingFiles[index];
      if (file.blob.size > MAX_INLINE_AUDIO_BYTES) {
        throw new Error(`${file.name} is too large for V2A inline transcription. Keep files below 18 MB for now.`);
      }

      targetHelper.innerHTML = `<strong>${helperTitle}</strong><p>Processing ${index + 1} of ${pendingFiles.length}: ${escapeHtml(file.name)}</p>`;
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

    targetHelper.innerHTML = `<strong>${isRecordedInterviewSource ? 'Recorded interview transcription complete' : 'Uploaded audio transcription complete'}</strong><p>The shared transcript box has been updated. Review the text before generating artifacts.</p>`;
    renderRecordings(mode);
    renderTranscriptionFiles(mode);
    updateGeneratorState();
  } catch (error) {
    showTranscriptionFallback(error instanceof Error ? error.message : 'Transcription failed.', pendingFiles, mode, isRecordedInterviewSource);
  } finally {
    stopButtonTimer();
    if (!actionButton) {
      targetButton.textContent = 'Transcribe';
    }
    if (actionButton && !actionButton.classList.contains('is-transcribed')) {
      actionButton.textContent = 'Transcribe';
    }
    updateTranscribeState(mode);
  }
}

function getTranscriptionHelper(mode: RecordingMode, isRecordedInterviewSource: boolean): HTMLDivElement {
  if (mode === 'followup') {
    return isRecordedInterviewSource ? followupRecordingTranscriptionHelper : followupTranscriptionHelper;
  }
  return isRecordedInterviewSource ? recordingTranscriptionHelper : transcriptionHelper;
}

function showTranscriptionFallback(
  message: string,
  filesForPrompt = transcriptionFiles,
  mode: RecordingMode = 'initial',
  isRecordedInterviewSource = false,
): void {
  const fileNames = filesForPrompt.map((file, index) => `${index + 1}. ${file.name}`).join('\n');
  const prompt = `Please transcribe these interview audio chunks in order. Preserve speaker labels where possible. After transcription, combine the chunks into one clean transcript. Do not summarize yet.\n\nFiles:\n${fileNames}`;
  const targetHelper = getTranscriptionHelper(mode, isRecordedInterviewSource);

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
  generateCandidateProfileButton.disabled = !hasTranscript;
  regenerateResumeButton.disabled = !hasTranscript || !hasFollowupTranscript;
  regenerateProfileButton.disabled = !lastUpdatedResumeMarkdown.trim();
  regenerateCandidateProfileButton.disabled = !hasTranscript || !hasFollowupTranscript;
  updateExportState();
}

function updateExportState(): void {
  const hasResume = lastResumeMarkdown.trim().length > 0;
  const hasTranscript = transcript.value.trim().length > 0;
  const hasFeedback = lastFeedbackText.trim().length > 0;
  const hasProfile = lastProfileSignals.length > 0 || lastProfileMarkdown.trim().length > 0;
  const hasCandidateProfile = lastCandidateProfileMarkdown.trim().length > 0;
  const hasFollowupTranscript = followupTranscript.value.trim().length > 0;
  const hasUpdatedResume = lastUpdatedResumeMarkdown.trim().length > 0;
  const hasUpdatedProfile = lastUpdatedProfileMarkdown.trim().length > 0;
  const hasUpdatedCandidateProfile = lastUpdatedCandidateProfileMarkdown.trim().length > 0;

  downloadResumeButton.disabled = !hasResume;
  downloadTranscriptButton.disabled = !hasTranscript;
  downloadFeedbackButton.disabled = !hasFeedback;
  downloadProfileButton.disabled = !hasProfile;
  downloadCandidateProfileButton.disabled = !hasCandidateProfile;
  downloadFollowupTranscriptButton.disabled = !hasFollowupTranscript;
  saveUpdatedResumePdfButton.disabled = !hasUpdatedResume;
  downloadUpdatedProfileButton.disabled = !hasUpdatedProfile;
  downloadUpdatedCandidateProfileButton.disabled = !hasUpdatedCandidateProfile;
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
  const applicantEvidence = buildApplicantEvidence(rawTranscript);
  const generationButton = mode === 'resume'
    ? generateResumeButton
    : mode === 'candidate'
      ? generateCandidateProfileButton
      : generateProfileButton;
  const busyText = mode === 'resume'
    ? 'Generating Resume...'
    : mode === 'candidate'
      ? 'Generating Candidate Profile...'
      : 'Generating Skill Profile...';

  setGenerationBusy(mode, true);
  const stopButtonTimer = startButtonTimer(generationButton, busyText);
  if (mode === 'resume') {
    renderDocumentOutput(resumeOutput, 'Generating resume...', EMPTY_RESUME_TEXT);
  } else if (mode === 'candidate') {
    renderDocumentOutput(candidateProfileOutput, 'Generating candidate profile...', EMPTY_CANDIDATE_PROFILE_TEXT);
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
        transcript: applicantEvidence,
        mode: mode === 'resume' ? 'resume' : 'profile',
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
    } else if (mode === 'candidate') {
      lastCandidateProfileMarkdown = '';
      renderDocumentOutput(candidateProfileOutput, `AI candidate profile generation failed: ${message}`, EMPTY_CANDIDATE_PROFILE_TEXT);
    } else {
      lastFeedbackText = '';
      profileOutput.className = 'profile-empty';
      profileOutput.textContent = 'AI skill profile was not generated.';
      renderFeedbackOutput(`Skill profile generation failed: ${message}`, []);
    }
  } finally {
    stopButtonTimer();
    setGenerationBusy(mode, false);
    updateExportState();
  }
}

function buildApplicantEvidence(initialTranscript: string): string {
  const applicantDirectInfo = collectApplicantDirectInfo();
  return [
    'INITIAL INTERVIEW TRANSCRIPT',
    initialTranscript,
    applicantDirectInfo ? ['', 'APPLICANT-PROVIDED DIRECT INFORMATION', applicantDirectInfo].join('\n') : '',
  ].filter(Boolean).join('\n');
}

function collectApplicantDirectInfo(): string {
  const fields = Array.from(document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('.applicant-direct-field'));
  return fields
    .map((field) => {
      const value = field.value.trim();
      const label = field.dataset.label || field.getAttribute('aria-label') || 'Applicant detail';
      return value ? `${label}: ${value}` : '';
    })
    .filter(Boolean)
    .join('\n');
}

function setGenerationBusy(mode: GenerationMode, isBusy: boolean): void {
  if (mode === 'resume') {
    generateResumeButton.disabled = isBusy;
    generateResumeButton.textContent = isBusy ? 'Generating Resume...' : 'Generate Resume';
  } else if (mode === 'candidate') {
    generateCandidateProfileButton.disabled = isBusy;
    generateCandidateProfileButton.textContent = isBusy ? 'Generating Candidate Profile...' : 'Generate Candidate Profile';
  } else {
    generateProfileButton.disabled = isBusy;
    generateProfileButton.textContent = isBusy ? 'Generating Skill Profile...' : 'Generate Skill Profile';
  }
}

function renderAiArtifacts(artifacts: AiArtifacts, mode: GenerationMode): void {
  if (mode === 'resume') {
    lastResumeMarkdown = getResumeArtifactContent(artifacts);
    renderDocumentOutput(resumeOutput, lastResumeMarkdown || EMPTY_RESUME_TEXT, EMPTY_RESUME_TEXT);
    copyResumeButton.disabled = !lastResumeMarkdown;
    return;
  }

  if (mode === 'candidate') {
    renderCandidateProfile(artifacts, candidateProfileOutput);
  } else {
    renderAiProfile(artifacts.profileCards || []);
  }

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
  const stopButtonTimer = startButtonTimer(regenerateResumeButton, 'Re-generating Resume...');
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
          buildApplicantEvidence(initialTranscript),
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

    lastUpdatedResumeMarkdown = getResumeArtifactContent(result as AiArtifacts);
    renderDocumentOutput(updatedResumeOutput, lastUpdatedResumeMarkdown || EMPTY_RESUME_TEXT, EMPTY_RESUME_TEXT);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Generation failed.';
    lastUpdatedResumeMarkdown = '';
    renderDocumentOutput(updatedResumeOutput, `AI updated resume generation failed: ${message}`, EMPTY_RESUME_TEXT);
  } finally {
    stopButtonTimer();
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
  const stopButtonTimer = startButtonTimer(regenerateProfileButton, 'Re-generating Skill Profile...');
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
          buildApplicantEvidence(transcript.value.trim()),
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
    stopButtonTimer();
    regenerateProfileButton.textContent = 'Re-generate Skill Profile';
    updateGeneratorState();
    updateExportState();
  }
}

async function regenerateCandidateProfile(): Promise<void> {
  const initialTranscript = transcript.value.trim();
  const followupText = followupTranscript.value.trim();
  if (initialTranscript.length <= 40 || followupText.length <= 40) {
    return;
  }

  regenerateCandidateProfileButton.disabled = true;
  const stopButtonTimer = startButtonTimer(regenerateCandidateProfileButton, 'Re-generating Candidate Profile...');
  renderDocumentOutput(updatedCandidateProfileOutput, 'Re-generating candidate profile...', EMPTY_CANDIDATE_PROFILE_TEXT);

  try {
    const context = readCandidateContext();
    const response = await fetch('/api/generate-artifacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        candidateName: context.name,
        target: context.target,
        transcript: [
          buildApplicantEvidence(initialTranscript),
          '',
          'FOLLOW-UP INTERVIEW TRANSCRIPT',
          followupText,
        ].join('\n'),
        existingResume: lastUpdatedResumeMarkdown || lastResumeMarkdown,
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

    renderCandidateProfile(result as AiArtifacts, updatedCandidateProfileOutput, true);
  } catch (error) {
    lastUpdatedCandidateProfileMarkdown = '';
    renderDocumentOutput(
      updatedCandidateProfileOutput,
      `Updated candidate profile generation failed: ${error instanceof Error ? error.message : 'Generation failed.'}`,
      EMPTY_CANDIDATE_PROFILE_TEXT,
    );
  } finally {
    stopButtonTimer();
    regenerateCandidateProfileButton.textContent = 'Re-generate Candidate Profile';
    updateGeneratorState();
    updateExportState();
  }
}

function getResumeArtifactContent(artifacts: AiArtifacts): string {
  return artifacts.resumeMarkdown || artifacts.resumeLatex || '';
}

function renderDocumentOutput(element: HTMLDivElement, content: string, emptyText: string): void {
  if (!content.trim() || content.trim() === emptyText) {
    element.className = 'document-output empty-output';
    element.textContent = emptyText;
    return;
  }

  element.className = 'document-output';
  if (isLatexDocument(content)) {
    element.innerHTML = renderLatexSourceHtml(content);
    return;
  }

  element.innerHTML = `<div class="resume-preview">${markdownToDocumentHtml(content)}</div>`;
}

function isLatexDocument(content: string): boolean {
  return /\\documentclass\b|\\begin\{document\}/.test(content);
}

function renderLatexSourceHtml(content: string): string {
  return `
    <div class="latex-output-note">
      <strong>Resume preview</strong>
      <span>Preview simulated from older LaTeX content. PDF export uses this formatted view.</span>
    </div>
    ${latexToResumePreviewHtml(content)}
  `;
}

function latexToResumePreviewHtml(content: string): string {
  const body = extractLatexBody(content);
  const lines = body
    .split('\n')
    .flatMap((line) => expandLatexLine(line))
    .map((line) => line.trim())
    .filter(Boolean);
  const html: string[] = [];
  let listOpen = false;

  lines.forEach((line) => {
    if (/^\\begin\{itemize\}/.test(line)) {
      if (!listOpen) {
        html.push('<ul>');
        listOpen = true;
      }
      return;
    }
    if (/^\\end\{itemize\}/.test(line)) {
      if (listOpen) {
        html.push('</ul>');
        listOpen = false;
      }
      return;
    }

    const sectionMatch = line.match(/^\\section\*?\{(.+)\}$/);
    if (sectionMatch) {
      if (listOpen) {
        html.push('</ul>');
        listOpen = false;
      }
      html.push(`<h3>${escapeHtml(cleanLatexText(sectionMatch[1]))}</h3>`);
      return;
    }

    const itemMatch = line.match(/^\\item\s+(.+)$/);
    if (itemMatch) {
      if (!listOpen) {
        html.push('<ul>');
        listOpen = true;
      }
      html.push(`<li>${escapeHtml(cleanLatexText(itemMatch[1]))}</li>`);
      return;
    }

    const cleaned = cleanLatexText(line);
    if (!cleaned) return;

    if (isLikelyResumeName(cleaned) && html.length === 0) {
      html.push(`<h2>${escapeHtml(cleaned)}</h2>`);
      return;
    }

    html.push(`<p>${escapeHtml(cleaned)}</p>`);
  });

  if (listOpen) {
    html.push('</ul>');
  }

  return `<div class="latex-preview">${html.join('') || '<p>No previewable LaTeX content was found.</p>'}</div>`;
}

function extractLatexBody(content: string): string {
  const match = content.match(/\\begin\{document\}([\s\S]*?)\\end\{document\}/);
  return match ? match[1] : content;
}

function expandLatexLine(line: string): string[] {
  return line
    .replace(/\\\\/g, '\n')
    .split('\n')
    .map((part) => part.trim());
}

function cleanLatexText(value: string): string {
  return value
    .replace(/\\begin\{center\}|\\end\{center\}/g, '')
    .replace(/\\(?:Large|LARGE|Huge|huge|textbf|textit)\{([^{}]*)\}/g, '$1')
    .replace(/\{\\(?:Large|LARGE|Huge|huge|bfseries|itshape)\s+([^{}]*)\}/g, '$1')
    .replace(/\\textbf\{([^{}]*)\}/g, '$1')
    .replace(/\\textit\{([^{}]*)\}/g, '$1')
    .replace(/\\vspace\{[^{}]*\}/g, '')
    .replace(/\\href\{[^{}]*\}\{([^{}]*)\}/g, '$1')
    .replace(/\\[a-zA-Z]+\*?(?:\[[^\]]*\])?(?:\{[^{}]*\})?/g, '')
    .replace(/\\([#$%&_^{}])/g, '$1')
    .replace(/[{}]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isLikelyResumeName(value: string): boolean {
  return value.length <= 80 && !/[.!?:]$/.test(value) && value.split(/\s+/).length <= 6;
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
    } else if (isResumeContactLine(trimmed)) {
      html.push(`<p class="doc-contact">${formatInlineMarkdown(trimmed)}</p>`);
    } else if (isResumeDateRow(trimmed)) {
      const [left, right] = splitResumeDateRow(trimmed);
      html.push(`
        <p class="doc-date-row">
          <span>${formatInlineMarkdown(left)}</span>
          <span>${formatInlineMarkdown(right)}</span>
        </p>
      `);
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

function isResumeContactLine(value: string): boolean {
  return /^(Email|Phone|Location|LinkedIn|GitHub|Portfolio|Website)\s*:/i.test(value);
}

function isResumeDateRow(value: string): boolean {
  const parts = value.split('|').map((part) => part.trim()).filter(Boolean);
  if (parts.length !== 2) {
    return false;
  }

  return /(\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\b|\b20\d{2}\b|\b19\d{2}\b|Present|Expected|Current)/i.test(parts[1]);
}

function splitResumeDateRow(value: string): [string, string] {
  const separatorIndex = value.indexOf('|');
  return [
    value.slice(0, separatorIndex).trim(),
    value.slice(separatorIndex + 1).trim(),
  ];
}

function formatInlineMarkdown(value: string): string {
  return escapeHtml(value)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>');
}

function renderCandidateProfile(artifacts: AiArtifacts, targetOutput = profileOutput, isUpdated = false): void {
  const content = artifacts.candidateProfileMarkdown?.trim()
    || buildCandidateProfileMarkdown(artifacts.profileCards || [], readCandidateContext());

  if (isUpdated) {
    lastUpdatedCandidateProfileMarkdown = content;
  } else if (targetOutput === candidateProfileOutput) {
    lastCandidateProfileMarkdown = content;
  } else {
    lastProfileSignals = [];
    lastProfileMarkdown = content;
  }

  renderDocumentOutput(targetOutput, content || EMPTY_PROFILE_TEXT, EMPTY_PROFILE_TEXT);
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
  const customCompany = customCompanyInput.value.trim();
  const customJobDescription = customJobDescriptionInput.value.trim();
  const customTarget = [
    customCompany ? `Company\n${customCompany}` : '',
    customJobDescription ? `Job Description\n${customJobDescription}` : '',
  ].filter(Boolean).join('\n\n');

  return {
    name: applicantNameInput.value.trim(),
    target: activeContextMode === 'custom' ? customTarget : JOB_DESCRIPTION_CONTEXT,
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
  saveResumeAsPdf(content);
}

function downloadUpdatedResume(): void {
  const content = lastUpdatedResumeMarkdown;
  if (!content.trim() || content.trim() === EMPTY_RESUME_TEXT) {
    return;
  }
  saveResumeAsPdf(content);
}

function downloadProfile(): void {
  const content = lastProfileMarkdown || buildProfileMarkdown(lastProfileSignals);
  if (!content.trim()) {
    return;
  }
  downloadTextFile(content, `${sessionSlug()}-skill-profile.md`, 'text/markdown');
}

function downloadCandidateProfile(): void {
  const content = lastCandidateProfileMarkdown;
  if (!content.trim()) {
    return;
  }
  downloadTextFile(content, `${sessionSlug()}-candidate-profile.md`, 'text/markdown');
}

function downloadTranscript(mode: RecordingMode): void {
  const content = mode === 'followup' ? followupTranscript.value : transcript.value;
  const trimmed = content.trim();
  if (!trimmed) {
    return;
  }

  const suffix = mode === 'followup' ? 'follow-up-transcript' : 'transcript';
  downloadTextFile(trimmed, `${sessionSlug()}-${suffix}.txt`, 'text/plain');
}

function downloadFeedback(): void {
  const content = lastFeedbackText.trim();
  if (!content) {
    return;
  }

  downloadTextFile(content, `${sessionSlug()}-interview-feedback.md`, 'text/markdown');
}

function downloadUpdatedProfile(): void {
  const content = lastUpdatedProfileMarkdown;
  if (!content.trim()) {
    return;
  }
  downloadTextFile(content, `${sessionSlug()}-updated-skill-profile.md`, 'text/markdown');
}

function downloadUpdatedCandidateProfile(): void {
  const content = lastUpdatedCandidateProfileMarkdown;
  if (!content.trim()) {
    return;
  }
  downloadTextFile(content, `${sessionSlug()}-updated-candidate-profile.md`, 'text/markdown');
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
            margin: 0;
            background: #ffffff;
            color: #111827;
            font-family: Georgia, "Times New Roman", serif;
            line-height: 1.25;
          }
          .resume-paper {
            max-width: 794px;
            margin: 0 auto;
            padding: 34px 34px;
            font-size: 12.5px;
          }
          h3 {
            margin: 18px 0 8px;
          }
          .doc-title {
            margin: 0 0 6px;
            font-size: 24px;
            font-weight: 900;
            line-height: 1.1;
            text-align: center;
            text-transform: uppercase;
          }
          .doc-section-title {
            border-bottom: 1px solid #111827;
            color: #111827;
            display: block;
            font-size: 14px;
            letter-spacing: 0;
            line-height: 1.18;
            padding: 0 12px 3px;
            text-transform: uppercase;
          }
          p {
            margin: 0 0 6px;
          }
          .doc-contact {
            margin: 0 0 2px;
            text-align: center;
          }
          .doc-date-row {
            display: flex;
            justify-content: space-between;
            gap: 18px;
            margin: 10px 0 1px;
            font-weight: 700;
          }
          .doc-date-row span:last-child {
            flex: 0 0 auto;
            text-align: right;
          }
          ul {
            margin: 0 0 6px;
            padding-left: 17px;
          }
          li {
            margin: 3px 0;
          }
        </style>
      </head>
      <body>
        <div class="resume-paper">
          ${isLatexDocument(content) ? latexToResumePreviewHtml(content) : markdownToDocumentHtml(content)}
        </div>
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

function buildCandidateProfileMarkdown(cards: AiProfileCard[], context: CandidateContext): string {
  if (!cards.length) {
    return '';
  }

  const strongest = [...cards]
    .sort((a, b) => (b.evidenceStrength || 0) - (a.evidenceStrength || 0))
    .slice(0, 3);
  const gaps = cards
    .map((card) => card.gap?.trim())
    .filter((gap): gap is string => Boolean(gap));

  return [
    `# Candidate Profile: ${context.name || 'Candidate'}`,
    '',
    '## Task Context',
    '',
    summarizeTargetContext(context.target),
    '',
    '## Best-Fit Strengths',
    '',
    ...(strongest.length
      ? strongest.map((card) => `- **${card.label}:** ${(card.evidence || [])[0] || 'Relevant evidence should be reviewed.'}`)
      : ['- Add stronger transcript evidence before identifying best-fit strengths.']),
    '',
    '## Evidence By Area',
    '',
    ...cards.flatMap((card) => [
      `### ${card.label}`,
      '',
      `Evidence support: ${Math.max(0, Math.min(100, card.evidenceStrength || 0))}% AI estimate`,
      '',
      ...((card.evidence || []).length ? card.evidence.map((item) => `- ${item}`) : ['- No concrete evidence captured yet.']),
      ...(card.gap ? [`- Gap to clarify: ${card.gap}`] : []),
      '',
    ]),
    '## Gaps To Clarify',
    '',
    ...(gaps.length ? gaps.map((gap) => `- ${gap}`) : ['- No major gaps were returned, but review the transcript before relying on this profile.']),
  ].join('\n');
}

function summarizeTargetContext(target: string): string {
  const cleaned = target.replace(/\s+/g, ' ').trim();
  if (!cleaned) {
    return 'No task description was provided. Add a target task, hackathon, role, or opportunity description to make this profile more specific.';
  }

  return cleaned.length > 420 ? `${cleaned.slice(0, 417).trim()}...` : cleaned;
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
  applicantInfoNameInput.value = 'Daniel';
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
