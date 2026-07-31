import './styles.css';
import fortyTwoLogo from '../assets/42_logo.png';
import buildPageImage from '../assets/build_page.png';
import landingImage from '../assets/landing_page.png';

type TabId = 'context' | 'applicant' | 'initial' | 'artifacts' | 'followup' | 'final';
type ArtifactResponse = {
  resumeMarkdown?: string;
  resumeLatex?: string;
  resumeEvidenceMap?: ResumeEvidenceMapItem[];
  candidateProfileMarkdown?: string;
  feedbackMarkdown?: string;
  followUpQuestions?: string[];
  profileCards?: Array<{
    label: string;
    evidenceStrength: number;
    evidence: string[];
    gap?: string;
  }>;
  provider?: string;
  error?: string;
  details?: string[];
};

type ResumeEvidenceMapItem = {
  resumeBullet: string;
  evidenceIds: string[];
  competency: string;
  source: string;
  confidence: number;
};

type TranscriptionResponse = {
  transcript?: string;
  provider?: string;
  error?: string;
  details?: string[];
};

type JobExtractionResponse = {
  status: 'ok' | 'restricted' | 'not_job';
  company?: string;
  jobDescription?: string;
  error?: string;
};

type QuestionGenerationResponse = {
  questions?: string[];
  error?: string;
  details?: string[];
};

type RecordingTarget = 'initial' | 'followup';
type EvidenceSource = 'applicant_information' | 'qualification' | 'initial_interview' | 'text_answer' | 'followup_answer';
type EvidenceStrength = 'High Evidence' | 'Medium Evidence' | 'Weak Evidence' | 'Missing';
type JobRequirement = {
  category: 'responsibility' | 'requirement' | 'qualification' | 'keyword' | 'competency';
  text: string;
  keywords: string[];
};
type EvidenceObject = {
  id: string;
  competency: string;
  supportingQuote: string;
  source: EvidenceSource;
  confidence: number;
  quantifiedValues: string[];
  relatedJob: string;
};
type CompetencyMatch = {
  competency: string;
  requirement: string;
  strength: EvidenceStrength;
  evidence: EvidenceObject[];
};
type EvidenceGraph = {
  jobRequirements: JobRequirement[];
  evidenceObjects: EvidenceObject[];
  competencyMatches: CompetencyMatch[];
};

const LOGIN_USER = import.meta.env.VITE_DEMO_LOGIN_USER || 'ite';
const LOGIN_PASSWORD = import.meta.env.VITE_DEMO_LOGIN_PASSWORD || '987654321';
const MAX_RECORDING_SECONDS = 10 * 60;
const MAX_INLINE_AUDIO_BYTES = 18 * 1024 * 1024;
const DEFAULT_QUESTIONS = [
  'Which role are you applying for, and why does it fit your current career direction?',
  'Tell me about your strongest relevant work experience or project.',
  'What tools, platforms, or methods have you used that match this job description?',
  'Describe one achievement with a clear outcome, number, or visible result.',
  'What responsibilities have you handled independently?',
  'How have you worked with teammates, clients, users, or stakeholders?',
  'Which qualification, training, or certification best supports this application?',
  'What gap should we address honestly before submitting the resume?',
];
const COPY_ICON_HTML = `
  <svg class="copy-icon" viewBox="0 0 24 24" aria-hidden="true">
    <rect x="9" y="9" width="11" height="11" rx="2"></rect>
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
  </svg>
`;

const appRoot = document.querySelector<HTMLDivElement>('#app');

if (!appRoot) {
  throw new Error('App root was not found.');
}

const app = appRoot;

let activeTab: TabId = 'context';
let isLoggedIn = window.sessionStorage.getItem('resume_builder_demo_user') === LOGIN_USER;
let mediaRecorder: MediaRecorder | null = null;
let activeStream: MediaStream | null = null;
let recordingChunks: BlobPart[] = [];
let recordingTarget: RecordingTarget = 'initial';
let recordingTimer: number | null = null;
let recordingSecondsRemaining = MAX_RECORDING_SECONDS;
let shouldTranscribeRecording = true;
let latestResume = '';
let latestSkillProfile = '';
let latestCandidateProfile = '';
let latestFeedback = '';
let latestFollowUpQuestions: string[] = [];
let latestResumeEvidenceMap: ResumeEvidenceMapItem[] = [];
let latestEvidenceGraph: EvidenceGraph = {
  jobRequirements: [],
  evidenceObjects: [],
  competencyMatches: [],
};
let evidenceReviewFilter: 'all' | 'usable' | 'weak' | 'ignored' = 'all';
let ignoredEvidenceIds = loadIgnoredEvidenceIds();

render();

function render(): void {
  app.innerHTML = isLoggedIn ? renderWorkspace() : renderLanding();
  isLoggedIn ? bindWorkspaceEvents() : bindLoginEvents();
}

function renderLanding(): string {
  return `
    <main class="login-page" style="--landing-image: url('${landingImage}')">
      <div class="powered-by-42" aria-label="Powered by 42 Singapore">
        <img class="forty-two-logo" src="${fortyTwoLogo}" alt="42 Singapore SUTD" />
        <span>Powered by 42 Singapore</span>
      </div>
      <section class="login-panel" aria-labelledby="login-title">
        <p class="eyebrow">Resume Builder</p>
        <h1 id="login-title">Build a resume for the job you want</h1>
        <p class="login-copy">For this branch, login is simulated for one test user.</p>
        <form class="login-form" id="login-form">
          <label>
            <span>Username</span>
            <input id="login-username" type="text" autocomplete="username" placeholder="Username" />
          </label>
          <label>
            <span>Password</span>
            <input id="login-password" type="password" autocomplete="current-password" placeholder="Password" />
          </label>
          <p class="form-message" id="login-message" role="alert"></p>
          <button class="primary action-button" type="submit">Login</button>
        </form>
      </section>
    </main>
  `;
}

function renderWorkspace(): string {
  return `
    <main class="app-shell">
      <aside class="sidebar" aria-label="Resume builder sections">
        <div class="sidebar-brand">
          <span>Resume Builder</span>
        </div>
        <p class="sidebar-caption">Job finder workflow</p>
        <nav class="step-nav">
          ${renderNavButton('context', '01', 'Context Setting', 'Job description and target role')}
          ${renderNavButton('applicant', '02', 'Applicant Information', 'Profile, contact and qualifications')}
          ${renderNavButton('initial', '03', 'Part 1 - Initial Interview', 'Record, transcribe or answer in text')}
          ${renderNavButton('artifacts', '04', 'Generate Profiles', 'Resume, skill and candidate profiles')}
          ${renderNavButton('followup', '05', 'Part 2 - Feedback', 'Follow-up questions and answers')}
          ${renderNavButton('final', '06', 'Generate Full Resume', 'Final resume output')}
        </nav>
        <button class="sidebar-logout" id="logout-button" type="button">Logout</button>
      </aside>

      <section class="workspace-shell" style="--build-page-image: url('${buildPageImage}')">
        <header class="workspace-header">
          <div>
            <p class="eyebrow">Regular Job Finder</p>
            <h1>Resume Builder</h1>
          </div>
          <span class="status-pill">demo session active</span>
        </header>
        <section class="tab-stage">
          ${renderActivePanel()}
        </section>
      </section>
    </main>
  `;
}

function renderNavButton(tab: TabId, number: string, label: string, description: string): string {
  return `
    <button class="nav-step ${activeTab === tab ? 'is-active' : ''}" type="button" data-tab="${tab}">
      <span class="step-number">${number}</span>
      <span>
        <strong>${label}</strong>
        <small>${description}</small>
      </span>
    </button>
  `;
}

function renderActivePanel(): string {
  if (activeTab === 'context') return renderContextPanel();
  if (activeTab === 'applicant') return renderApplicantPanel();
  if (activeTab === 'initial') return renderInitialInterviewPanel();
  if (activeTab === 'artifacts') return renderArtifactsPanel();
  if (activeTab === 'followup') return renderFollowupPanel();
  return renderFinalPanel();
}

function renderContextPanel(): string {
  return `
    <article class="panel">
      <div class="panel-heading">
        <div>
          <p class="section-kicker">01 Context Setting</p>
          <h2>Target Job Context</h2>
        </div>
        <button class="secondary" id="extract-job-button" type="button">Import Job</button>
      </div>
      <div class="field-grid two-columns">
        <label>
          <span>Job link</span>
          <input id="job-url" type="url" placeholder="https://company.com/careers/job..." />
        </label>
        <label class="file-control">
          <span>Upload job description or image</span>
          <input id="job-file" type="file" accept=".txt,.md,.html,.htm,.csv,.json,.pdf,.doc,.docx,text/*,image/*" />
          <strong id="job-file-name">No file selected</strong>
        </label>
      </div>
      <div class="field-grid two-columns">
        <label>
          <span>Company</span>
          <input id="company-name" type="text" placeholder="Company name" />
        </label>
        <label>
          <span>Target role</span>
          <input id="target-role" type="text" placeholder="Role title" />
        </label>
      </div>
      <label>
        <span>Job description / requirements</span>
        <textarea id="job-description" rows="13" placeholder="Paste the job description, responsibilities, requirements, and useful keywords here."></textarea>
      </label>
      <label>
        <span>Resume strategy notes</span>
        <textarea id="context-notes" rows="5" placeholder="Add target keywords, application deadline, portfolio links to emphasize, or constraints."></textarea>
      </label>
      <p class="form-message" id="job-import-status" role="status"></p>
      <div class="footer-actions">
        <button class="primary" type="button" data-go-next="applicant">Continue</button>
      </div>
    </article>
  `;
}

function renderApplicantPanel(): string {
  return `
    <article class="panel">
      <div class="panel-heading">
        <div>
          <p class="section-kicker">02 Applicant Information</p>
          <h2>Applicant Basics</h2>
        </div>
      </div>
      <div class="field-grid three-columns">
        <label><span>Full name</span><input id="applicant-name" type="text" placeholder="Candidate name" /></label>
        <label><span>Email</span><input id="applicant-email" type="email" placeholder="name@email.com" /></label>
        <label><span>Phone</span><input id="applicant-phone" type="tel" placeholder="+65 9000 0000" /></label>
        <label><span>Location</span><input id="applicant-location" type="text" placeholder="City, country" /></label>
        <label><span>LinkedIn</span><input id="applicant-linkedin" type="url" placeholder="https://linkedin.com/in/..." /></label>
        <label><span>Portfolio / GitHub</span><input id="applicant-portfolio" type="url" placeholder="https://..." /></label>
      </div>
      <div class="field-grid two-columns">
        <label>
          <span>Highest qualification</span>
          <input id="highest-qualification" type="text" placeholder="Degree, diploma, certificate, bootcamp, etc." />
        </label>
        <label>
          <span>Core skills</span>
          <input id="core-skills" type="text" placeholder="Excel, customer service, React, sales..." />
        </label>
      </div>
      <section class="subpanel">
        <div class="subpanel-heading">
          <h3>Additional Qualifications</h3>
          <button class="secondary" id="add-qualification" type="button">Add</button>
        </div>
        <div id="qualification-list" class="qualification-list">
          ${renderQualificationRow(0)}
        </div>
      </section>
      <label>
        <span>Additional applicant input</span>
        <textarea id="additional-applicant-info" rows="8" placeholder="Awards, volunteer work, languages, certifications, preferred roles, or anything the resume should know."></textarea>
      </label>
      <div class="footer-actions">
        <button class="ghost" type="button" data-go-next="context">Back</button>
        <button class="primary" type="button" data-go-next="initial">Continue</button>
      </div>
    </article>
  `;
}

function renderQualificationRow(index: number): string {
  return `
    <div class="qualification-row">
      <input class="qualification-title" type="text" placeholder="Qualification or course" aria-label="Qualification ${index + 1}" />
      <input class="qualification-school" type="text" placeholder="Institution" aria-label="Institution ${index + 1}" />
      <input class="qualification-month" type="month" aria-label="Month and year ${index + 1}" />
      <button class="icon-only remove-qualification" type="button" aria-label="Remove qualification" title="Remove">×</button>
    </div>
  `;
}

function renderInitialInterviewPanel(): string {
  return `
    <article class="panel">
      <div class="panel-heading">
        <div>
          <p class="section-kicker">03 Part 1 - Initial Interview</p>
          <h2>Interview Capture</h2>
        </div>
        <button class="secondary" id="generate-questions-button" type="button">Generate Questions</button>
      </div>
      <section class="question-box">
        <div class="subpanel-heading">
          <h3>Questions</h3>
          <div class="text-answer-control">
            <label class="toggle-row">
              <input id="text-answer-toggle" type="checkbox" />
              <span>Answer questions in text</span>
            </label>
            <p>if candidate is not available for interview</p>
          </div>
        </div>
        <ol id="question-list">
          ${renderQuestionItems(DEFAULT_QUESTIONS)}
        </ol>
        <p class="form-message" id="question-status" role="status"></p>
      </section>
      ${renderRecorder('initial')}
      <section class="subpanel">
        <div class="subpanel-heading">
          <h3>Transcription</h3>
        </div>
        <textarea id="initial-transcript" rows="13" placeholder="Transcription for the initial interview will appear here."></textarea>
      </section>
      <div class="footer-actions">
        <button class="ghost" type="button" data-go-next="applicant">Back</button>
        <button class="primary" type="button" data-go-next="artifacts">Continue</button>
      </div>
    </article>
  `;
}

function renderQuestionItems(questions: string[]): string {
  return questions
    .map((question, index) => `
      <li class="question-item">
        <span class="question-text">${escapeHtml(question)}</span>
        <textarea
          id="text-answer-${index}"
          class="question-answer hidden"
          rows="4"
          placeholder="Candidate answer"
          aria-label="Answer for question ${index + 1}"
        ></textarea>
      </li>
    `)
    .join('');
}

function renderFollowupQuestionItems(questions: string[]): string {
  return questions
    .map((question, index) => `
      <li class="question-item">
        <span class="question-text">${escapeHtml(question)}</span>
        <textarea
          id="followup-answer-${index}"
          class="followup-answer hidden"
          rows="4"
          placeholder="Candidate follow-up answer"
          aria-label="Answer for follow-up question ${index + 1}"
        ></textarea>
      </li>
    `)
    .join('');
}

function renderRecorder(target: RecordingTarget): string {
  const label = target === 'initial' ? 'Initial interview audio' : 'Follow-up audio';
  return `
    <section class="subpanel recorder" data-recorder="${target}">
      <div class="subpanel-heading">
        <h3>${label}</h3>
        <span class="timer" id="${target}-timer">10:00</span>
      </div>
      <div class="recorder-actions">
        <button class="record-control record" type="button" data-record-start="${target}" aria-label="Start recording" title="Start recording">●</button>
        <button class="record-control" type="button" data-record-stop="${target}" aria-label="Stop and transcribe" title="Stop and transcribe" disabled>■</button>
        <label class="file-control compact">
          <span>Upload audio</span>
          <input id="${target}-audio-file" type="file" accept="audio/*,.ogg,.oga,.opus,.webm,.m4a,.mp3,.wav,.aac,.flac" />
          <strong id="${target}-audio-name">No file selected</strong>
        </label>
        <button class="secondary" id="${target}-transcribe-upload" type="button" disabled>Transcribe</button>
      </div>
      <p class="form-message" id="${target}-recording-status" role="status"></p>
    </section>
  `;
}

function renderArtifactsPanel(): string {
  return `
    <article class="panel">
      <div class="panel-heading">
        <div>
          <p class="section-kicker">04 Generate Resume / Skill Profile / Candidate Profile</p>
          <h2>Profile Generation</h2>
        </div>
        <div class="button-cluster">
          <button class="primary" id="generate-resume-button" type="button">Resume</button>
          <button class="secondary" id="generate-profile-button" type="button">Skill + Candidate</button>
        </div>
      </div>
      <div class="output-grid">
        <section class="document-box">
          <div class="subpanel-heading">
            <h3>Resume Draft</h3>
            <button class="copy-button" id="copy-resume-button" type="button" aria-label="Copy resume draft" title="Copy resume draft">${COPY_ICON_HTML}</button>
          </div>
          <div class="document-output" id="resume-output">Generate a resume draft after completing the context, applicant information, and initial interview.</div>
        </section>
        <section class="document-box">
          <div class="subpanel-heading">
            <h3>Skill Profile</h3>
            <button class="copy-button" id="copy-skill-profile-button" type="button" aria-label="Copy skill profile" title="Copy skill profile">${COPY_ICON_HTML}</button>
          </div>
          <div class="document-output" id="skill-profile-output">Generate a skill profile to see evidence-backed strengths.</div>
        </section>
        <section class="document-box wide">
          <div class="subpanel-heading">
            <h3>Candidate Profile</h3>
            <button class="copy-button" id="copy-candidate-profile-button" type="button" aria-label="Copy candidate profile" title="Copy candidate profile">${COPY_ICON_HTML}</button>
          </div>
          <div class="document-output" id="candidate-profile-output">Generate a candidate profile to compare this applicant against the role.</div>
        </section>
        <section class="document-box wide">
          <div class="subpanel-heading">
            <h3>Structured Evidence Review</h3>
            <div class="evidence-filter-group" role="group" aria-label="Evidence filter">
              <button class="evidence-filter is-active" type="button" data-evidence-filter="all">All</button>
              <button class="evidence-filter" type="button" data-evidence-filter="usable">High/Medium</button>
              <button class="evidence-filter" type="button" data-evidence-filter="weak">Weak</button>
              <button class="evidence-filter" type="button" data-evidence-filter="ignored">Ignored</button>
            </div>
          </div>
          <div class="evidence-summary" id="evidence-output">Generate profiles to build the evidence layer.</div>
        </section>
      </div>
      <p class="form-message" id="artifact-status" role="status"></p>
      <div class="footer-actions">
        <button class="ghost" type="button" data-go-next="initial">Back</button>
        <button class="primary" type="button" data-go-next="followup">Continue</button>
      </div>
    </article>
  `;
}

function renderFollowupPanel(): string {
  return `
    <article class="panel">
      <div class="panel-heading">
        <div>
          <p class="section-kicker">05 Part 2 - Interview Feedback and Follow Up Questions</p>
          <h2>Evidence Gaps</h2>
        </div>
        <button class="secondary" id="refresh-feedback-button" type="button">Refresh Feedback</button>
      </div>
      <div class="output-grid">
        <section class="document-box">
          <h3>Interview Feedback</h3>
          <div class="document-output compact-output" id="feedback-output">Generate the skill/candidate profile first to see feedback here.</div>
        </section>
        <section class="document-box">
          <div class="subpanel-heading">
            <h3>Follow-up Questions</h3>
            <div class="text-answer-control">
              <label class="toggle-row">
                <input id="followup-text-answer-toggle" type="checkbox" />
                <span>Answer questions in text</span>
              </label>
              <p>if candidate is not available for interview</p>
            </div>
          </div>
          <ol class="followup-questions" id="followup-question-list">
            ${renderFollowupQuestionItems(['Generate profile feedback to receive follow-up questions.'])}
          </ol>
        </section>
      </div>
      ${renderRecorder('followup')}
      <label>
        <span>Follow-up answers / transcription</span>
        <textarea id="followup-transcript" rows="11" placeholder="Record, upload, or type follow-up answers here."></textarea>
      </label>
      <div class="footer-actions">
        <button class="ghost" type="button" data-go-next="artifacts">Back</button>
        <button class="primary" type="button" data-go-next="final">Continue</button>
      </div>
    </article>
  `;
}

function renderFinalPanel(): string {
  return `
    <article class="panel">
      <div class="panel-heading">
        <div>
          <p class="section-kicker">06 Generate Full Resume</p>
          <h2>Final Resume</h2>
        </div>
        <div class="button-cluster">
          <button class="primary" id="generate-final-resume" type="button">Generate Full Resume</button>
          <button class="ghost" id="print-final-resume" type="button">Print</button>
        </div>
      </div>
      <section class="document-box final-evidence-box">
        <div class="subpanel-heading">
          <h3>Final Evidence Check</h3>
          <button class="secondary" id="refresh-final-evidence" type="button">Refresh Evidence</button>
        </div>
        <div class="evidence-summary" id="final-evidence-output">Refresh evidence before generating the final resume.</div>
      </section>
      <div class="document-output final-document" id="final-resume-output">Generate the full resume after the follow-up section is complete.</div>
      <section class="document-box final-evidence-box">
        <h3>Evidence Used</h3>
        <div class="evidence-summary" id="resume-evidence-map-output">Generate the full resume to see which evidence supports each bullet.</div>
      </section>
      <p class="form-message" id="final-status" role="status"></p>
      <div class="footer-actions">
        <button class="ghost" type="button" data-go-next="followup">Back</button>
      </div>
    </article>
  `;
}

function bindLoginEvents(): void {
  const form = getElement<HTMLFormElement>('login-form');
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const username = getElement<HTMLInputElement>('login-username').value.trim();
    const password = getElement<HTMLInputElement>('login-password').value;
    const message = getElement('login-message');

    if (username === LOGIN_USER && password === LOGIN_PASSWORD) {
      window.sessionStorage.setItem('resume_builder_demo_user', LOGIN_USER);
      isLoggedIn = true;
      activeTab = 'context';
      render();
      return;
    }

    message.textContent = 'Invalid username or password.';
    message.classList.add('is-error');
  });
}

function bindWorkspaceEvents(): void {
  document.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((button) => {
    button.addEventListener('click', () => {
      saveCurrentTabState();
      activeTab = button.dataset.tab as TabId;
      render();
      restoreTabState();
    });
  });

  document.querySelectorAll<HTMLButtonElement>('[data-go-next]').forEach((button) => {
    button.addEventListener('click', () => {
      saveCurrentTabState();
      activeTab = button.dataset.goNext as TabId;
      render();
      restoreTabState();
    });
  });

  getOptional('logout-button')?.addEventListener('click', () => {
    window.sessionStorage.removeItem('resume_builder_demo_user');
    isLoggedIn = false;
    render();
  });

  bindCurrentTabEvents();
  restoreTabState();
}

function bindCurrentTabEvents(): void {
  if (activeTab === 'context') {
    getElement('extract-job-button').addEventListener('click', extractJobContext);
    getElement<HTMLInputElement>('job-file').addEventListener('change', handleJobFileSelection);
  }

  if (activeTab === 'applicant') {
    getElement('add-qualification').addEventListener('click', addQualificationRow);
    getElement('qualification-list').addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      if (target.closest('.remove-qualification')) {
        target.closest('.qualification-row')?.remove();
      }
    });
  }

  if (activeTab === 'initial') {
    getElement('generate-questions-button').addEventListener('click', generateInterviewQuestions);
    getElement<HTMLInputElement>('text-answer-toggle').addEventListener('change', toggleTextAnswers);
    bindRecorderEvents('initial');
  }

  if (activeTab === 'artifacts') {
    getElement('generate-resume-button').addEventListener('click', generateResumeDraft);
    getElement('generate-profile-button').addEventListener('click', generateProfileArtifacts);
    getElement('copy-resume-button').addEventListener('click', () => copyArtifact('resume'));
    getElement('copy-skill-profile-button').addEventListener('click', () => copyArtifact('skill'));
    getElement('copy-candidate-profile-button').addEventListener('click', () => copyArtifact('candidate'));
    bindEvidenceReviewEvents();
  }

  if (activeTab === 'followup') {
    getElement('refresh-feedback-button').addEventListener('click', refreshFeedbackFromProfile);
    getElement<HTMLInputElement>('followup-text-answer-toggle').addEventListener('change', toggleFollowupTextAnswers);
    bindRecorderEvents('followup');
  }

  if (activeTab === 'final') {
    getElement('generate-final-resume').addEventListener('click', generateFinalResume);
    getElement('print-final-resume').addEventListener('click', printFinalResume);
    getElement('refresh-final-evidence').addEventListener('click', refreshFinalEvidence);
  }
}

function bindRecorderEvents(target: RecordingTarget): void {
  document.querySelector<HTMLButtonElement>(`[data-record-start="${target}"]`)?.addEventListener('click', () => startRecording(target));
  document.querySelector<HTMLButtonElement>(`[data-record-stop="${target}"]`)?.addEventListener('click', () => stopRecording(true));
  getElement<HTMLInputElement>(`${target}-audio-file`).addEventListener('change', () => handleAudioSelection(target));
  getElement(`${target}-transcribe-upload`).addEventListener('click', () => transcribeSelectedAudio(target));
}

function bindEvidenceReviewEvents(): void {
  document.querySelectorAll<HTMLButtonElement>('[data-evidence-filter]').forEach((button) => {
    button.addEventListener('click', () => {
      evidenceReviewFilter = button.dataset.evidenceFilter as typeof evidenceReviewFilter;
      paintEvidenceReview();
    });
  });

  getOptional('evidence-output')?.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-ignore-evidence]');
    if (!button) return;
    const id = button.dataset.ignoreEvidence || '';
    if (!id) return;
    if (ignoredEvidenceIds.has(id)) {
      ignoredEvidenceIds.delete(id);
    } else {
      ignoredEvidenceIds.add(id);
    }
    saveIgnoredEvidenceIds();
    latestEvidenceGraph = buildEvidenceGraph(false);
    paintGeneratedOutputs();
  });
}

function saveCurrentTabState(): void {
  document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea').forEach((field) => {
    if (field.type === 'file') return;
    window.sessionStorage.setItem(storageKey(field.id || field.name), field.value);
  });
  window.sessionStorage.setItem('resume_builder_questions', getOptional('question-list')?.innerHTML || window.sessionStorage.getItem('resume_builder_questions') || '');
  window.sessionStorage.setItem('resume_builder_qualifications', getOptional('qualification-list')?.innerHTML || window.sessionStorage.getItem('resume_builder_qualifications') || '');
  const currentQualifications = qualificationValues();
  if (currentQualifications.length) {
    window.sessionStorage.setItem('resume_builder_qualification_values', JSON.stringify(currentQualifications));
  }
}

function restoreTabState(): void {
  const questions = window.sessionStorage.getItem('resume_builder_questions');
  const questionList = getOptional('question-list');
  if (questions && questionList) questionList.innerHTML = questions;
  if (questionList) ensureQuestionAnswerFields(questionList);

  const qualifications = window.sessionStorage.getItem('resume_builder_qualifications');
  const qualificationList = getOptional('qualification-list');
  if (qualifications && qualificationList) qualificationList.innerHTML = qualifications;

  document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea').forEach((field) => {
    if (!field.id || field.type === 'file') return;
    const value = window.sessionStorage.getItem(storageKey(field.id));
    if (value !== null) field.value = value;
  });

  if (activeTab === 'initial') toggleTextAnswers();
  if (activeTab === 'followup') toggleFollowupTextAnswers();
  if (activeTab === 'final') refreshFinalEvidence();

  paintGeneratedOutputs();
}

function storageKey(id: string): string {
  return `resume_builder_${id}`;
}

async function extractJobContext(): Promise<void> {
  const status = getElement('job-import-status');
  const jobUrl = getElement<HTMLInputElement>('job-url').value.trim();
  const jobFile = getElement<HTMLInputElement>('job-file').files?.[0] || null;
  status.textContent = 'Importing job context...';
  status.className = 'form-message';

  try {
    let result: JobExtractionResponse;
    if (jobFile) {
      const isImage = jobFile.type.startsWith('image/');
      result = await postJson<JobExtractionResponse>('/api/extract-job-document', {
        name: jobFile.name,
        mimeType: jobFile.type || 'application/octet-stream',
        text: isImage ? '' : await jobFile.text(),
        data: isImage ? await blobToBase64(jobFile) : '',
      });
    } else if (jobUrl) {
      result = await postJson<JobExtractionResponse>('/api/extract-job-url', { url: jobUrl });
    } else {
      throw new Error('Add a job link or upload a job description first.');
    }

    if (result.status === 'ok') {
      getElement<HTMLInputElement>('company-name').value = result.company || '';
      getElement<HTMLTextAreaElement>('job-description').value = result.jobDescription || '';
      status.textContent = 'Job context imported.';
      status.classList.add('is-success');
      return;
    }

    status.textContent = result.error || 'Could not identify this as a job posting. Paste the details manually.';
    status.classList.add('is-error');
  } catch (error) {
    status.textContent = errorMessage(error);
    status.classList.add('is-error');
  }
}

function handleJobFileSelection(): void {
  const file = getElement<HTMLInputElement>('job-file').files?.[0];
  getElement('job-file-name').textContent = file ? file.name : 'No file selected';
}

function addQualificationRow(): void {
  const list = getElement('qualification-list');
  const nextIndex = list.querySelectorAll('.qualification-row').length;
  list.insertAdjacentHTML('beforeend', renderQualificationRow(nextIndex));
}

async function generateInterviewQuestions(): Promise<void> {
  saveCurrentTabState();
  const status = getElement('question-status');
  status.textContent = 'Generating role-specific questions...';
  status.className = 'form-message';

  try {
    const response = await postJson<QuestionGenerationResponse>('/api/generate-interview-questions', {
      company: getStoredOrCurrent('company-name'),
      jobDescription: getStoredOrCurrent('job-description'),
    });

    if (!response.questions?.length) {
      throw new Error(response.error || 'No questions were returned.');
    }

    getElement('question-list').innerHTML = renderQuestionItems(response.questions);
    toggleTextAnswers();
    status.textContent = 'Questions generated.';
    status.classList.add('is-success');
  } catch (error) {
    status.textContent = `${errorMessage(error)} Using default questions for now.`;
    status.classList.add('is-error');
  }
}

function toggleTextAnswers(): void {
  const enabled = getElement<HTMLInputElement>('text-answer-toggle').checked;
  ensureQuestionAnswerFields(getElement('question-list'));
  document.querySelectorAll('.question-answer').forEach((field) => {
    field.classList.toggle('hidden', !enabled);
  });
}

function toggleFollowupTextAnswers(): void {
  const enabled = getElement<HTMLInputElement>('followup-text-answer-toggle').checked;
  ensureFollowupAnswerFields(getElement('followup-question-list'));
  document.querySelectorAll('.followup-answer').forEach((field) => {
    field.classList.toggle('hidden', !enabled);
  });
}

function ensureQuestionAnswerFields(questionList: HTMLElement): void {
  const items = Array.from(questionList.querySelectorAll<HTMLLIElement>('li'));
  items.forEach((item, index) => {
    if (item.querySelector('.question-answer')) return;

    const question = item.textContent?.trim() || '';
    item.classList.add('question-item');
    item.innerHTML = `
      <span class="question-text">${escapeHtml(question)}</span>
      <textarea
        id="text-answer-${index}"
        class="question-answer hidden"
        rows="4"
        placeholder="Candidate answer"
        aria-label="Answer for question ${index + 1}"
      ></textarea>
    `;
  });
}

function ensureFollowupAnswerFields(questionList: HTMLElement): void {
  const items = Array.from(questionList.querySelectorAll<HTMLLIElement>('li'));
  items.forEach((item, index) => {
    if (item.querySelector('.followup-answer')) return;

    const question = item.textContent?.trim() || '';
    item.classList.add('question-item');
    item.innerHTML = `
      <span class="question-text">${escapeHtml(question)}</span>
      <textarea
        id="followup-answer-${index}"
        class="followup-answer hidden"
        rows="4"
        placeholder="Candidate follow-up answer"
        aria-label="Answer for follow-up question ${index + 1}"
      ></textarea>
    `;
  });
}

async function startRecording(target: RecordingTarget): Promise<void> {
  if (mediaRecorder) return;
  recordingTarget = target;
  setRecordingStatus(target, 'Requesting microphone access...');

  try {
    activeStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    recordingChunks = [];
    const mimeType = pickRecordingMimeType();
    mediaRecorder = new MediaRecorder(activeStream, mimeType ? { mimeType } : undefined);
    mediaRecorder.addEventListener('dataavailable', (event) => {
      if (event.data.size > 0) recordingChunks.push(event.data);
    });
    mediaRecorder.addEventListener('stop', () => finishRecording());
    mediaRecorder.start();
    recordingSecondsRemaining = MAX_RECORDING_SECONDS;
    setRecordingButtons(target, true);
    setRecordingStatus(target, 'Recording...');
    tickRecordingTimer(target);
  } catch (error) {
    cleanupRecording();
    setRecordingStatus(target, errorMessage(error), true);
  }
}

function stopRecording(shouldTranscribe: boolean): void {
  if (!mediaRecorder) return;
  shouldTranscribeRecording = shouldTranscribe;
  mediaRecorder.stop();
}

async function finishRecording(): Promise<void> {
  const target = recordingTarget;
  const mimeType = mediaRecorder?.mimeType || 'audio/webm';
  const blob = new Blob(recordingChunks, { type: mimeType });
  cleanupRecording();
  setRecordingButtons(target, false);

  if (!shouldTranscribeRecording || blob.size === 0) {
    setRecordingStatus(target, 'Recording stopped.');
    return;
  }

  await transcribeBlob(target, blob, `${target}-interview.webm`);
}

function cleanupRecording(): void {
  if (recordingTimer !== null) {
    window.clearInterval(recordingTimer);
    recordingTimer = null;
  }
  activeStream?.getTracks().forEach((track) => track.stop());
  activeStream = null;
  mediaRecorder = null;
  recordingChunks = [];
}

function tickRecordingTimer(target: RecordingTarget): void {
  updateTimer(target);
  recordingTimer = window.setInterval(() => {
    recordingSecondsRemaining -= 1;
    updateTimer(target);
    if (recordingSecondsRemaining <= 0) stopRecording(true);
  }, 1000);
}

function updateTimer(target: RecordingTarget): void {
  const timer = getOptional(`${target}-timer`);
  if (!timer) return;
  const minutes = Math.floor(recordingSecondsRemaining / 60);
  const seconds = recordingSecondsRemaining % 60;
  timer.textContent = `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function setRecordingButtons(target: RecordingTarget, recording: boolean): void {
  const start = document.querySelector<HTMLButtonElement>(`[data-record-start="${target}"]`);
  const stop = document.querySelector<HTMLButtonElement>(`[data-record-stop="${target}"]`);
  if (start) start.disabled = recording;
  if (stop) stop.disabled = !recording;
}

function pickRecordingMimeType(): string {
  return ['audio/ogg;codecs=opus', 'audio/ogg', 'audio/webm;codecs=opus', 'audio/webm'].find((type) => MediaRecorder.isTypeSupported(type)) || '';
}

function handleAudioSelection(target: RecordingTarget): void {
  const file = getElement<HTMLInputElement>(`${target}-audio-file`).files?.[0];
  getElement(`${target}-audio-name`).textContent = file ? file.name : 'No file selected';
  (getElement(`${target}-transcribe-upload`) as HTMLButtonElement).disabled = !file;
}

async function transcribeSelectedAudio(target: RecordingTarget): Promise<void> {
  const file = getElement<HTMLInputElement>(`${target}-audio-file`).files?.[0];
  if (!file) return;
  await transcribeBlob(target, file, file.name);
}

async function transcribeBlob(target: RecordingTarget, blob: Blob, name: string): Promise<void> {
  const status = getElement(`${target}-recording-status`);
  status.textContent = 'Transcribing audio...';
  status.className = 'form-message';

  try {
    if (blob.size > MAX_INLINE_AUDIO_BYTES) {
      throw new Error('Audio is too large. Use a shorter recording or smaller upload.');
    }
    const response = await postJson<TranscriptionResponse>('/api/transcribe', {
      name,
      mimeType: blob.type || 'audio/webm',
      data: await blobToBase64(blob),
      applicantName: getStoredOrCurrent('applicant-name') || 'Applicant',
    });

    if (!response.transcript) {
      throw new Error(formatApiError(response.error || 'No transcript was returned.', response.details));
    }

    const transcriptId = target === 'initial' ? 'initial-transcript' : 'followup-transcript';
    getElement<HTMLTextAreaElement>(transcriptId).value = response.transcript;
    saveCurrentTabState();
    status.textContent = `Transcribed${response.provider ? ` with ${response.provider}` : ''}.`;
    status.classList.add('is-success');
  } catch (error) {
    status.textContent = errorMessage(error);
    status.classList.add('is-error');
  }
}

async function generateResumeDraft(): Promise<void> {
  await generateResume('resume-output', 'artifact-status', false);
}

async function generateFinalResume(): Promise<void> {
  await generateResume('final-resume-output', 'final-status', true);
}

async function generateResume(outputId: string, statusId: string, includeFollowup: boolean): Promise<void> {
  saveCurrentTabState();
  latestEvidenceGraph = buildEvidenceGraph(includeFollowup);
  if (includeFollowup) paintFinalEvidence();
  const status = getElement(statusId);
  const readiness = summarizeEvidenceReadiness(latestEvidenceGraph);
  status.textContent = includeFollowup ? 'Generating full resume...' : 'Generating resume draft...';
  status.className = 'form-message';

  if (includeFollowup && readiness.high + readiness.medium === 0) {
    status.textContent = 'Final resume needs at least one high or medium evidence item before generation.';
    status.classList.add('is-error');
    return;
  }

  try {
    const response = await postJson<ArtifactResponse>('/api/generate-artifacts', {
      mode: 'resume',
      candidateName: getStoredOrCurrent('applicant-name'),
      target: buildTargetContext(),
      transcript: buildEvidenceText(includeFollowup),
      evidenceGraph: latestEvidenceGraph,
      existingResume: includeFollowup ? latestResume : '',
    });

    const resume = response.resumeMarkdown || response.resumeLatex || '';
    if (!resume) throw new Error(response.error || 'No resume was returned.');
    latestResume = resume;
    latestResumeEvidenceMap = includeFollowup
      ? normalizeResumeEvidenceMap(response.resumeEvidenceMap || [], resume, latestEvidenceGraph)
      : [];
    getElement(outputId).innerHTML = markdownToHtml(resume);
    paintResumeEvidenceMap();
    status.textContent = includeFollowup
      ? finalResumeStatusMessage(readiness)
      : 'Resume draft generated.';
    status.classList.add('is-success');
  } catch (error) {
    const fallback = buildLocalResume(includeFollowup);
    latestResume = fallback;
    latestResumeEvidenceMap = includeFollowup ? buildLocalResumeEvidenceMap(fallback, latestEvidenceGraph) : [];
    getElement(outputId).innerHTML = markdownToHtml(fallback);
    paintResumeEvidenceMap();
    status.textContent = `${errorMessage(error)} Showing local draft.`;
    status.classList.add('is-error');
  }
}

async function generateProfileArtifacts(): Promise<void> {
  saveCurrentTabState();
  latestEvidenceGraph = buildEvidenceGraph(false);
  const status = getElement('artifact-status');
  status.textContent = 'Generating skill and candidate profiles...';
  status.className = 'form-message';

  try {
    const response = await postJson<ArtifactResponse>('/api/generate-artifacts', {
      mode: 'profile',
      candidateName: getStoredOrCurrent('applicant-name'),
      target: buildTargetContext(),
      transcript: buildEvidenceText(false),
      evidenceGraph: latestEvidenceGraph,
    });

    latestSkillProfile = response.profileCards?.length ? renderProfileCardsMarkdown(response.profileCards) : '';
    latestCandidateProfile = response.candidateProfileMarkdown || '';
    latestFeedback = response.feedbackMarkdown || '';
    latestFollowUpQuestions = selectFollowUpQuestions(response.followUpQuestions || [], latestEvidenceGraph);

    if (!latestSkillProfile && !latestCandidateProfile) {
      throw new Error(response.error || 'No profile artifacts were returned.');
    }

    paintGeneratedOutputs();
    status.textContent = 'Profiles generated.';
    status.classList.add('is-success');
  } catch (error) {
    latestSkillProfile = buildLocalSkillProfile();
    latestCandidateProfile = buildLocalCandidateProfile();
    latestFeedback = buildEvidenceGapFeedback(latestEvidenceGraph);
    latestFollowUpQuestions = buildEvidenceGapQuestions(latestEvidenceGraph);
    paintGeneratedOutputs();
    status.textContent = `${errorMessage(error)} Showing local profile draft.`;
    status.classList.add('is-error');
  }
}

function refreshFeedbackFromProfile(): void {
  saveCurrentTabState();
  latestEvidenceGraph = buildEvidenceGraph(false);
  latestFeedback = buildEvidenceGapFeedback(latestEvidenceGraph);
  latestFollowUpQuestions = buildEvidenceGapQuestions(latestEvidenceGraph);
  paintGeneratedOutputs();
}

function refreshFinalEvidence(): void {
  saveCurrentTabState();
  latestEvidenceGraph = buildEvidenceGraph(true);
  paintFinalEvidence();
}

function paintGeneratedOutputs(): void {
  const resumeOutput = getOptional('resume-output');
  if (resumeOutput && latestResume) resumeOutput.innerHTML = markdownToHtml(latestResume);

  const skillProfileOutput = getOptional('skill-profile-output');
  if (skillProfileOutput && latestSkillProfile) skillProfileOutput.innerHTML = markdownToHtml(latestSkillProfile);

  const candidateProfileOutput = getOptional('candidate-profile-output');
  if (candidateProfileOutput && latestCandidateProfile) candidateProfileOutput.innerHTML = markdownToHtml(latestCandidateProfile);

  paintEvidenceReview();

  const feedbackOutput = getOptional('feedback-output');
  if (feedbackOutput && latestFeedback) feedbackOutput.innerHTML = markdownToHtml(latestFeedback);

  const followupQuestionList = getOptional('followup-question-list');
  if (followupQuestionList && latestFollowUpQuestions.length) {
    followupQuestionList.innerHTML = renderFollowupQuestionItems(latestFollowUpQuestions);
    toggleFollowupTextAnswers();
  }

  const finalOutput = getOptional('final-resume-output');
  if (finalOutput && latestResume) finalOutput.innerHTML = markdownToHtml(latestResume);

  paintFinalEvidence();
  paintResumeEvidenceMap();
}

function buildEvidenceText(includeFollowup: boolean): string {
  const evidenceGraph = latestEvidenceGraph.evidenceObjects.length ? latestEvidenceGraph : buildEvidenceGraph(includeFollowup);
  const sections = [
    'STRUCTURED EVIDENCE GRAPH',
    JSON.stringify(evidenceGraph, null, 2),
    '',
    'APPLICANT INFORMATION',
    applicantSummary(),
    '',
    'INITIAL INTERVIEW TRANSCRIPT OR TEXT ANSWERS',
    getStoredOrCurrent('initial-transcript'),
    questionAnswerSummary(),
  ];

  if (includeFollowup) {
    sections.push('', 'FOLLOW-UP ANSWERS', getStoredOrCurrent('followup-transcript'));
    sections.push(followupAnswerSummary());
  }

  return sections.filter(Boolean).join('\n');
}

function buildTargetContext(): string {
  return [
    getStoredOrCurrent('company-name') ? `Company: ${getStoredOrCurrent('company-name')}` : '',
    getStoredOrCurrent('target-role') ? `Target role: ${getStoredOrCurrent('target-role')}` : '',
    getStoredOrCurrent('job-description') ? `Job description:\n${getStoredOrCurrent('job-description')}` : '',
    getStoredOrCurrent('context-notes') ? `Strategy notes:\n${getStoredOrCurrent('context-notes')}` : '',
  ].filter(Boolean).join('\n\n');
}

function buildEvidenceGraph(includeFollowup: boolean): EvidenceGraph {
  const jobRequirements = parseJobRequirements();
  const evidenceObjects = collectEvidenceObjects(includeFollowup, jobRequirements)
    .filter((item) => !ignoredEvidenceIds.has(item.id));
  const competencyMatches = classifyCompetencies(jobRequirements, evidenceObjects);
  return {
    jobRequirements,
    evidenceObjects,
    competencyMatches,
  };
}

function parseJobRequirements(): JobRequirement[] {
  const jobText = [
    getStoredOrCurrent('target-role'),
    getStoredOrCurrent('job-description'),
    getStoredOrCurrent('context-notes'),
  ].filter(Boolean).join('\n');
  const lines = jobText
    .split(/\r?\n|[•*]\s+|;\s+/)
    .map((line) => line.replace(/^[-–]\s*/, '').trim())
    .filter((line) => line.length >= 4);
  const requirements = lines
    .map((line) => ({
      category: categorizeRequirement(line),
      text: line,
      keywords: extractKeywords(line),
    }))
    .filter((item) => item.keywords.length > 0)
    .slice(0, 32);

  return requirements.length
    ? requirements
    : extractKeywords(jobText).map((keyword) => ({
        category: 'keyword',
        text: keyword,
        keywords: [keyword],
      }));
}

function categorizeRequirement(line: string): JobRequirement['category'] {
  const value = line.toLowerCase();
  if (/\b(responsibilit|duties|you will|deliver|manage|build|support|coordinate)\b/.test(value)) return 'responsibility';
  if (/\b(require|must|need|proficient|experience with|knowledge of)\b/.test(value)) return 'requirement';
  if (/\b(degree|diploma|qualification|certification|certified|education)\b/.test(value)) return 'qualification';
  if (/\b(communication|leadership|analytical|problem|team|stakeholder|customer|client)\b/.test(value)) return 'competency';
  return 'keyword';
}

function collectEvidenceObjects(includeFollowup: boolean, jobRequirements: JobRequirement[]): EvidenceObject[] {
  const evidence: EvidenceObject[] = [];
  const applicantFields: Array<[string, string]> = [
    ['Contact and identity', applicantSummary()],
    ['Highest qualification', getStoredOrCurrent('highest-qualification')],
    ['Core skills', getStoredOrCurrent('core-skills')],
    ['Applicant notes', getStoredOrCurrent('additional-applicant-info')],
  ];

  applicantFields.forEach(([competency, value]) => {
    if (!value.trim()) return;
    evidence.push(createEvidenceObject(competency, value, 'applicant_information', jobRequirements));
  });

  qualificationValues().forEach((value) => {
    evidence.push(createEvidenceObject('Qualification', value, 'qualification', jobRequirements));
  });

  splitEvidenceSentences(getStoredOrCurrent('initial-transcript')).forEach((sentence) => {
    evidence.push(createEvidenceObject(inferCompetency(sentence, jobRequirements), sentence, 'initial_interview', jobRequirements));
  });

  textQuestionAnswers().forEach((answer) => {
    evidence.push(createEvidenceObject(inferCompetency(answer.answer, jobRequirements), `Q: ${answer.question}\nA: ${answer.answer}`, 'text_answer', jobRequirements));
  });

  if (includeFollowup) {
    splitEvidenceSentences(getStoredOrCurrent('followup-transcript')).forEach((sentence) => {
      evidence.push(createEvidenceObject(inferCompetency(sentence, jobRequirements), sentence, 'followup_answer', jobRequirements));
    });
    followupTextAnswers().forEach((answer) => {
      evidence.push(createEvidenceObject(inferCompetency(answer.answer, jobRequirements), `Q: ${answer.question}\nA: ${answer.answer}`, 'followup_answer', jobRequirements));
    });
  }

  return evidence
    .filter((item) => item.supportingQuote.trim().length > 0)
    .slice(0, 80);
}

function createEvidenceObject(competency: string, supportingQuote: string, source: EvidenceSource, jobRequirements: JobRequirement[]): EvidenceObject {
  const relatedJob = findRelatedRequirement(supportingQuote, jobRequirements);
  const quantifiedValues = extractQuantifiedValues(supportingQuote);
  return {
    id: makeEvidenceId(source, competency, supportingQuote),
    competency,
    supportingQuote: trimForDocument(supportingQuote),
    source,
    confidence: estimateEvidenceConfidence(supportingQuote, source, relatedJob, quantifiedValues),
    quantifiedValues,
    relatedJob,
  };
}

function classifyCompetencies(jobRequirements: JobRequirement[], evidenceObjects: EvidenceObject[]): CompetencyMatch[] {
  return jobRequirements.slice(0, 24).map((requirement) => {
    const evidence = evidenceObjects.filter((item) => {
      const haystack = `${item.competency} ${item.supportingQuote} ${item.relatedJob}`.toLowerCase();
      return requirement.keywords.some((keyword) => haystack.includes(keyword.toLowerCase()));
    });
    const bestConfidence = Math.max(0, ...evidence.map((item) => item.confidence));
    const strength: EvidenceStrength = evidence.length === 0
      ? 'Missing'
      : bestConfidence >= 0.78
        ? 'High Evidence'
        : bestConfidence >= 0.55
          ? 'Medium Evidence'
          : 'Weak Evidence';

    return {
      competency: requirement.keywords[0] || requirement.text,
      requirement: requirement.text,
      strength,
      evidence: evidence.slice(0, 3),
    };
  });
}

function selectFollowUpQuestions(aiQuestions: string[], graph: EvidenceGraph): string[] {
  const gapQuestions = buildEvidenceGapQuestions(graph);
  if (!gapQuestions.length) return aiQuestions.slice(0, 8);

  const gapWords = extractKeywords(graph.competencyMatches
    .filter((match) => match.strength === 'Weak Evidence' || match.strength === 'Missing')
    .map((match) => `${match.competency} ${match.requirement}`)
    .join(' '));
  const targetedAiQuestions = aiQuestions.filter((question) => {
    const lower = question.toLowerCase();
    return gapWords.some((word) => lower.includes(word));
  });

  return dedupeQuestions([...targetedAiQuestions, ...gapQuestions]).slice(0, 8);
}

function buildEvidenceGapQuestions(graph: EvidenceGraph): string[] {
  const gaps = graph.competencyMatches
    .filter((match) => match.strength === 'Weak Evidence' || match.strength === 'Missing')
    .slice(0, 8);

  if (!gaps.length) {
    return [
      'Which achievement from your recent work should we emphasize most strongly in the final resume?',
      'What measurable result can we add to make your strongest evidence more specific?',
    ];
  }

  return gaps.map((gap) => {
    const requirement = gap.requirement || gap.competency;
    if (gap.strength === 'Missing') {
      return `The job asks for "${requirement}". What specific experience, project, training, or example can prove this?`;
    }
    return `For "${requirement}", what concrete result, tool, responsibility, or number can strengthen the existing evidence?`;
  });
}

function buildEvidenceGapFeedback(graph: EvidenceGraph): string {
  const weakOrMissing = graph.competencyMatches
    .filter((match) => match.strength === 'Weak Evidence' || match.strength === 'Missing');
  const strong = graph.competencyMatches
    .filter((match) => match.strength === 'High Evidence' || match.strength === 'Medium Evidence');

  if (!graph.jobRequirements.length) {
    return 'Add a job description first so follow-up questions can target the role requirements.';
  }

  if (!weakOrMissing.length) {
    return `Most tracked job requirements have usable evidence. Before final resume generation, add quantified outcomes for the strongest ${Math.min(strong.length, 3)} evidence areas.`;
  }

  return [
    `${strong.length} job requirements have high or medium evidence.`,
    `${weakOrMissing.length} requirements still need stronger support.`,
    'The follow-up questions below focus only on weak or missing competencies so the final resume has better evidence.',
  ].join(' ');
}

function dedupeQuestions(questions: string[]): string[] {
  const seen = new Set<string>();
  return questions
    .map((question) => question.trim())
    .filter((question) => {
      const key = question.toLowerCase();
      if (!question || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function renderEvidenceGraphHtml(graph: EvidenceGraph): string {
  const counts = graph.competencyMatches.reduce<Record<EvidenceStrength, number>>((acc, item) => {
    acc[item.strength] += 1;
    return acc;
  }, {
    'High Evidence': 0,
    'Medium Evidence': 0,
    'Weak Evidence': 0,
    Missing: 0,
  });

  return `
    <div class="evidence-metrics">
      <span><strong>${graph.evidenceObjects.length}</strong> evidence objects</span>
      <span><strong>${counts['High Evidence']}</strong> high</span>
      <span><strong>${counts['Medium Evidence']}</strong> medium</span>
      <span><strong>${counts['Weak Evidence']}</strong> weak</span>
      <span><strong>${counts.Missing}</strong> missing</span>
    </div>
    <div class="evidence-list">
      ${graph.competencyMatches.slice(0, 8).map((match) => `
        <article class="evidence-row">
          <strong>${escapeHtml(match.strength)}</strong>
          <span>${escapeHtml(match.requirement)}</span>
        </article>
      `).join('')}
    </div>
  `;
}

function paintEvidenceReview(): void {
  const output = getOptional('evidence-output');
  if (!output) return;
  const reviewItems = collectEvidenceObjects(false, parseJobRequirements());
  if (!reviewItems.length) {
    output.textContent = 'Generate profiles to build the evidence layer.';
    return;
  }
  output.innerHTML = renderEvidenceReviewHtml(latestEvidenceGraph, reviewItems);
  document.querySelectorAll<HTMLButtonElement>('[data-evidence-filter]').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.evidenceFilter === evidenceReviewFilter);
  });
}

function renderEvidenceReviewHtml(graph: EvidenceGraph, reviewItems: EvidenceObject[]): string {
  const counts = summarizeEvidenceReadiness(graph);
  const filtered = reviewItems.filter((item) => {
    const ignored = ignoredEvidenceIds.has(item.id);
    if (evidenceReviewFilter === 'ignored') return ignored;
    if (ignored) return false;
    if (evidenceReviewFilter === 'usable') return item.confidence >= 0.55;
    if (evidenceReviewFilter === 'weak') return item.confidence < 0.55;
    return true;
  });

  return `
    <div class="evidence-metrics">
      <span><strong>${graph.evidenceObjects.length}</strong> active evidence</span>
      <span><strong>${ignoredEvidenceIds.size}</strong> ignored</span>
      <span><strong>${counts.high}</strong> high</span>
      <span><strong>${counts.medium}</strong> medium</span>
      <span><strong>${counts.weak}</strong> weak</span>
      <span><strong>${counts.missing}</strong> missing</span>
    </div>
    <div class="evidence-card-list">
      ${filtered.slice(0, 24).map((item) => renderEvidenceCard(item)).join('') || '<p>No evidence matches this filter.</p>'}
    </div>
  `;
}

function renderEvidenceCard(item: EvidenceObject): string {
  const ignored = ignoredEvidenceIds.has(item.id);
  return `
    <article class="evidence-card ${ignored ? 'is-ignored' : ''}">
      <div class="evidence-card-topline">
        <strong>${escapeHtml(item.competency)}</strong>
        <span>${Math.round(item.confidence * 100)}% confidence</span>
      </div>
      <p>${escapeHtml(item.supportingQuote)}</p>
      <dl>
        <div><dt>Source</dt><dd>${escapeHtml(item.source.replace(/_/g, ' '))}</dd></div>
        <div><dt>Related job</dt><dd>${escapeHtml(item.relatedJob || 'No direct match yet')}</dd></div>
        <div><dt>Quantified</dt><dd>${escapeHtml(item.quantifiedValues.join(', ') || 'None found')}</dd></div>
      </dl>
      <button class="mini-action" type="button" data-ignore-evidence="${escapeHtml(item.id)}">${ignored ? 'Restore' : 'Ignore'}</button>
    </article>
  `;
}

function paintFinalEvidence(): void {
  const output = getOptional('final-evidence-output');
  if (!output) return;
  if (!latestEvidenceGraph.evidenceObjects.length) {
    output.textContent = 'No structured evidence yet. Complete applicant information and interview answers first.';
    return;
  }
  output.innerHTML = renderFinalEvidenceHtml(latestEvidenceGraph);
}

function renderFinalEvidenceHtml(graph: EvidenceGraph): string {
  const readiness = summarizeEvidenceReadiness(graph);
  const warning = readiness.weak + readiness.missing > readiness.high + readiness.medium
    ? '<p class="evidence-warning">Many role requirements still have weak or missing evidence. The final resume will omit unsupported claims.</p>'
    : '<p class="evidence-ready">Evidence is usable for final resume generation. Stronger quantified results will still improve the resume.</p>';
  const usableEvidence = graph.evidenceObjects
    .filter((item) => item.confidence >= 0.55)
    .slice(0, 6);

  return `
    <div class="evidence-metrics">
      <span><strong>${graph.evidenceObjects.length}</strong> evidence objects</span>
      <span><strong>${readiness.high}</strong> high</span>
      <span><strong>${readiness.medium}</strong> medium</span>
      <span><strong>${readiness.weak}</strong> weak</span>
      <span><strong>${readiness.missing}</strong> missing</span>
    </div>
    ${warning}
    <div class="evidence-list">
      ${usableEvidence.map((item) => `
        <article class="evidence-row">
          <strong>${escapeHtml(item.competency)}</strong>
          <span>${escapeHtml(item.supportingQuote)}</span>
        </article>
      `).join('') || '<p>No high or medium evidence items are available yet.</p>'}
    </div>
  `;
}

function summarizeEvidenceReadiness(graph: EvidenceGraph): { high: number; medium: number; weak: number; missing: number } {
  return graph.competencyMatches.reduce((acc, item) => {
    if (item.strength === 'High Evidence') acc.high += 1;
    if (item.strength === 'Medium Evidence') acc.medium += 1;
    if (item.strength === 'Weak Evidence') acc.weak += 1;
    if (item.strength === 'Missing') acc.missing += 1;
    return acc;
  }, { high: 0, medium: 0, weak: 0, missing: 0 });
}

function finalResumeStatusMessage(readiness: { high: number; medium: number; weak: number; missing: number }): string {
  const unsupported = readiness.weak + readiness.missing;
  if (unsupported > readiness.high + readiness.medium) {
    return 'Full resume generated with unsupported claims omitted. Consider answering more follow-up questions.';
  }
  return 'Full resume generated from structured evidence.';
}

function normalizeResumeEvidenceMap(items: ResumeEvidenceMapItem[], resume: string, graph: EvidenceGraph): ResumeEvidenceMapItem[] {
  const bullets = extractResumeBullets(resume);
  const mapped = items
    .map((item) => ({
      resumeBullet: String(item.resumeBullet || '').trim(),
      evidenceIds: Array.isArray(item.evidenceIds) ? item.evidenceIds.map(String).filter(Boolean) : [],
      competency: String(item.competency || '').trim(),
      source: String(item.source || '').trim(),
      confidence: Math.max(0, Math.min(1, Number(item.confidence) || 0)),
    }))
    .filter((item) => item.resumeBullet);
  const mappedBullets = new Set(mapped.map((item) => normalizeBulletText(item.resumeBullet)));
  const fallback = buildLocalResumeEvidenceMap(resume, graph)
    .filter((item) => !mappedBullets.has(normalizeBulletText(item.resumeBullet)));
  const all = [...mapped, ...fallback];

  return bullets.map((bullet) => {
    const exact = all.find((item) => normalizeBulletText(item.resumeBullet) === normalizeBulletText(bullet));
    return exact || {
      resumeBullet: bullet,
      evidenceIds: [],
      competency: 'Unmapped resume bullet',
      source: 'unmapped',
      confidence: 0,
    };
  });
}

function buildLocalResumeEvidenceMap(resume: string, graph: EvidenceGraph): ResumeEvidenceMapItem[] {
  return extractResumeBullets(resume).map((bullet) => {
    const evidence = findBestEvidenceForBullet(bullet, graph.evidenceObjects);
    return {
      resumeBullet: bullet,
      evidenceIds: evidence.map((item) => item.id),
      competency: evidence[0]?.competency || 'Unmapped resume bullet',
      source: evidence[0]?.source || 'unmapped',
      confidence: evidence[0]?.confidence || 0,
    };
  });
}

function findBestEvidenceForBullet(bullet: string, evidenceObjects: EvidenceObject[]): EvidenceObject[] {
  const bulletWords = extractKeywords(bullet);
  return evidenceObjects
    .map((item) => ({
      item,
      score: bulletWords.filter((word) => `${item.competency} ${item.supportingQuote} ${item.relatedJob}`.toLowerCase().includes(word)).length +
        item.quantifiedValues.filter((value) => bullet.toLowerCase().includes(value.toLowerCase())).length * 2,
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || b.item.confidence - a.item.confidence)
    .slice(0, 3)
    .map((entry) => entry.item);
}

function extractResumeBullets(resume: string): string[] {
  return resume
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^[-*]\s+/.test(line))
    .map((line) => line.replace(/^[-*]\s+/, '').trim())
    .filter((line) => line && !/^\*\*?(languages|web|software|tools|tech)\b/i.test(line));
}

function normalizeBulletText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function paintResumeEvidenceMap(): void {
  const output = getOptional('resume-evidence-map-output');
  if (!output) return;
  if (!latestResumeEvidenceMap.length) {
    output.textContent = 'Generate the full resume to see which evidence supports each bullet.';
    return;
  }
  output.innerHTML = renderResumeEvidenceMapHtml(latestResumeEvidenceMap, latestEvidenceGraph);
}

function renderResumeEvidenceMapHtml(map: ResumeEvidenceMapItem[], graph: EvidenceGraph): string {
  const evidenceById = new Map(graph.evidenceObjects.map((item) => [item.id, item]));
  return `
    <div class="evidence-card-list">
      ${map.map((item) => {
        const evidence = item.evidenceIds.map((id) => evidenceById.get(id)).filter((entry): entry is EvidenceObject => Boolean(entry));
        const risky = evidence.length === 0;
        return `
          <article class="evidence-card ${risky ? 'is-risky' : ''}">
            <div class="evidence-card-topline">
              <strong>${risky ? 'Needs Review' : escapeHtml(item.competency || evidence[0].competency)}</strong>
              <span>${Math.round((item.confidence || evidence[0]?.confidence || 0) * 100)}% confidence</span>
            </div>
            <p><strong>Resume bullet:</strong> ${escapeHtml(item.resumeBullet)}</p>
            ${evidence.length
              ? evidence.map((entry) => `<p><strong>${escapeHtml(entry.source.replace(/_/g, ' '))}:</strong> ${escapeHtml(entry.supportingQuote)}</p>`).join('')
              : '<p>No supporting evidence was mapped to this bullet. Review before using it.</p>'}
          </article>
        `;
      }).join('')}
    </div>
  `;
}

function applicantSummary(): string {
  return [
    fieldLine('Name', 'applicant-name'),
    fieldLine('Email', 'applicant-email'),
    fieldLine('Phone', 'applicant-phone'),
    fieldLine('Location', 'applicant-location'),
    fieldLine('LinkedIn', 'applicant-linkedin'),
    fieldLine('Portfolio / GitHub', 'applicant-portfolio'),
    fieldLine('Highest Qualification', 'highest-qualification'),
    fieldLine('Core Skills', 'core-skills'),
    qualificationsSummary(),
    fieldLine('Additional Applicant Input', 'additional-applicant-info'),
  ].filter(Boolean).join('\n');
}

function qualificationsSummary(): string {
  const values = qualificationValues();
  return values.length ? `Additional Qualifications:\n${values.map((item) => `- ${item}`).join('\n')}` : '';
}

function qualificationValues(): string[] {
  const rows = Array.from(document.querySelectorAll('.qualification-row'));
  const values = rows.map((row) => {
    const title = row.querySelector<HTMLInputElement>('.qualification-title')?.value.trim();
    const school = row.querySelector<HTMLInputElement>('.qualification-school')?.value.trim();
    const month = row.querySelector<HTMLInputElement>('.qualification-month')?.value.trim();
    return [title, school, month].filter(Boolean).join(' - ');
  }).filter(Boolean);

  if (values.length) return values;

  try {
    const stored = JSON.parse(window.sessionStorage.getItem('resume_builder_qualification_values') || '[]');
    return Array.isArray(stored) ? stored.map((item) => String(item || '').trim()).filter(Boolean) : [];
  } catch (error) {
    return [];
  }
}

function questionAnswerSummary(): string {
  const answers = textQuestionAnswers();
  return answers.length ? `TEXT QUESTION ANSWERS\n${answers.map((item) => `Q: ${item.question}\nA: ${item.answer}`).join('\n\n')}` : '';
}

function textQuestionAnswers(): Array<{ question: string; answer: string }> {
  const rows = Array.from(document.querySelectorAll('.question-item'));
  return rows.map((row) => {
    const question = row.querySelector('.question-text')?.textContent?.trim();
    const answer = row.querySelector<HTMLTextAreaElement>('.question-answer')?.value.trim();
    if (!question || !answer) return null;
    return { question, answer };
  }).filter((item): item is { question: string; answer: string } => Boolean(item));
}

function followupAnswerSummary(): string {
  const answers = followupTextAnswers();
  return answers.length ? `TEXT FOLLOW-UP ANSWERS\n${answers.map((item) => `Q: ${item.question}\nA: ${item.answer}`).join('\n\n')}` : '';
}

function followupTextAnswers(): Array<{ question: string; answer: string }> {
  const rows = Array.from(document.querySelectorAll('#followup-question-list .question-item'));
  return rows.map((row) => {
    const question = row.querySelector('.question-text')?.textContent?.trim();
    const answer = row.querySelector<HTMLTextAreaElement>('.followup-answer')?.value.trim();
    if (!question || !answer) return null;
    return { question, answer };
  }).filter((item): item is { question: string; answer: string } => Boolean(item));
}

function extractKeywords(value: string): string[] {
  const stopWords = new Set([
    'about', 'above', 'after', 'again', 'also', 'and', 'are', 'can', 'for', 'from', 'have', 'into',
    'job', 'must', 'our', 'the', 'this', 'that', 'their', 'they', 'with', 'will', 'work', 'you', 'your',
  ]);
  return Array.from(new Set((value.toLowerCase().match(/[a-z][a-z+#.-]{2,}/g) || [])
    .filter((word) => !stopWords.has(word))
    .slice(0, 10)));
}

function splitEvidenceSentences(value: string): string[] {
  return value
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+|\n+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 28)
    .slice(0, 36);
}

function inferCompetency(value: string, jobRequirements: JobRequirement[]): string {
  const related = findRelatedRequirement(value, jobRequirements);
  if (related) return extractKeywords(related)[0] || related;

  const lower = value.toLowerCase();
  if (/\b(team|collaborat|stakeholder|client|customer|communicat)\b/.test(lower)) return 'Communication';
  if (/\b(manage|lead|coordinate|organize|deadline)\b/.test(lower)) return 'Ownership';
  if (/\b(analy|data|metric|report|insight)\b/.test(lower)) return 'Analysis';
  if (/\b(build|develop|implement|design|code|debug|test)\b/.test(lower)) return 'Technical execution';
  if (/\b(sales|support|service|relationship)\b/.test(lower)) return 'Customer focus';
  return 'General candidate evidence';
}

function findRelatedRequirement(value: string, jobRequirements: JobRequirement[]): string {
  const lower = value.toLowerCase();
  const match = jobRequirements.find((requirement) =>
    requirement.keywords.some((keyword) => keyword.length > 2 && lower.includes(keyword.toLowerCase())),
  );
  return match?.text || '';
}

function extractQuantifiedValues(value: string): string[] {
  return value.match(/\b\d+(?:[.,]\d+)?%?\b|\b(?:weekly|monthly|quarterly|annually|daily)\b/gi) || [];
}

function estimateEvidenceConfidence(value: string, source: EvidenceSource, relatedJob: string, quantifiedValues: string[]): number {
  let confidence = source === 'applicant_information' || source === 'qualification' ? 0.62 : 0.5;
  if (relatedJob) confidence += 0.18;
  if (quantifiedValues.length) confidence += 0.14;
  if (/\b(built|created|led|managed|improved|reduced|increased|delivered|implemented|supported|designed)\b/i.test(value)) confidence += 0.12;
  if (value.length > 140) confidence += 0.06;
  return Math.min(0.95, Number(confidence.toFixed(2)));
}

function makeEvidenceId(source: EvidenceSource, competency: string, quote: string): string {
  const seed = `${source}|${competency}|${quote}`.toLowerCase();
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = ((hash << 5) - hash + seed.charCodeAt(index)) | 0;
  }
  return `ev_${Math.abs(hash).toString(36)}`;
}

function loadIgnoredEvidenceIds(): Set<string> {
  try {
    const stored = JSON.parse(window.sessionStorage.getItem('resume_builder_ignored_evidence') || '[]');
    return new Set(Array.isArray(stored) ? stored.map((item) => String(item || '')).filter(Boolean) : []);
  } catch (error) {
    return new Set();
  }
}

function saveIgnoredEvidenceIds(): void {
  window.sessionStorage.setItem('resume_builder_ignored_evidence', JSON.stringify(Array.from(ignoredEvidenceIds)));
}

function fieldLine(label: string, id: string): string {
  const value = getStoredOrCurrent(id);
  return value ? `${label}: ${value}` : '';
}

function getStoredOrCurrent(id: string): string {
  const field = getOptional(id) as HTMLInputElement | HTMLTextAreaElement | null;
  if (field && 'value' in field) return field.value.trim();
  return window.sessionStorage.getItem(storageKey(id)) || '';
}

function buildLocalResume(includeFollowup: boolean): string {
  const name = getStoredOrCurrent('applicant-name') || 'Candidate Name';
  return [
    `# ${name}`,
    '',
    [getStoredOrCurrent('applicant-email'), getStoredOrCurrent('applicant-phone'), getStoredOrCurrent('applicant-location')].filter(Boolean).join(' | '),
    '',
    '## Professional Summary',
    `Job seeker targeting ${getStoredOrCurrent('target-role') || 'the selected role'}, with evidence collected from applicant information and interview notes.`,
    '',
    '## Core Skills',
    getStoredOrCurrent('core-skills') || 'Add skills in Applicant Information.',
    '',
    '## Qualifications',
    getStoredOrCurrent('highest-qualification') || 'Add highest qualification.',
    qualificationsSummary(),
    '',
    '## Interview Evidence',
    trimForDocument(getStoredOrCurrent('initial-transcript') || questionAnswerSummary() || 'Add interview evidence.'),
    ...(includeFollowup ? ['', '## Follow-up Evidence', trimForDocument(getStoredOrCurrent('followup-transcript') || 'Add follow-up answers.')] : []),
  ].filter(Boolean).join('\n');
}

function buildLocalSkillProfile(): string {
  return [
    '# Skill Profile',
    '',
    '## Evidence Sources',
    '- Applicant information',
    '- Initial interview transcript or text answers',
    '',
    '## Skills To Validate',
    `- ${getStoredOrCurrent('core-skills') || 'Add core skills before finalizing.'}`,
  ].join('\n');
}

function buildLocalCandidateProfile(): string {
  return [
    '# Candidate Profile',
    '',
    `Candidate: ${getStoredOrCurrent('applicant-name') || 'Candidate'}`,
    `Target: ${getStoredOrCurrent('target-role') || 'Target role not set'}`,
    '',
    '## Fit Notes',
    trimForDocument(getStoredOrCurrent('context-notes') || 'Add strategy notes and interview evidence to improve fit analysis.'),
  ].join('\n');
}

function renderProfileCardsMarkdown(cards: NonNullable<ArtifactResponse['profileCards']>): string {
  return [
    '# Skill Profile',
    '',
    ...cards.flatMap((card) => [
      `## ${card.label}`,
      `Evidence strength: ${card.evidenceStrength || 0}%`,
      ...(card.evidence || []).map((item) => `- ${item}`),
      ...(card.gap ? [`- Gap: ${card.gap}`] : []),
      '',
    ]),
  ].join('\n');
}

async function copyArtifact(kind: 'resume' | 'skill' | 'candidate'): Promise<void> {
  const content = kind === 'resume'
    ? latestResume
    : kind === 'skill'
      ? latestSkillProfile
      : latestCandidateProfile;
  if (!content.trim()) return;
  await navigator.clipboard.writeText(content);
}

function printFinalResume(): void {
  const output = getOptional('final-resume-output');
  if (!output) return;
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;
  printWindow.document.write(`
    <!doctype html>
    <html>
      <head>
        <title>Final Resume</title>
        <style>
          body { margin: 0; font-family: Georgia, "Times New Roman", serif; color: #111827; }
          main { max-width: 790px; margin: 0 auto; padding: 34px; }
          h1 { text-align: center; text-transform: uppercase; }
          h2 { border-bottom: 1px solid #111827; padding-bottom: 4px; text-transform: uppercase; }
        </style>
      </head>
      <body><main>${output.innerHTML}</main><script>window.print();</script></body>
    </html>
  `);
  printWindow.document.close();
}

async function postJson<T>(url: string, payload: unknown): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || `Request failed with ${response.status}`);
  }
  return data as T;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || '').split(',')[1] || '');
    reader.onerror = () => reject(reader.error || new Error('Could not read audio file.'));
    reader.readAsDataURL(blob);
  });
}

function markdownToHtml(markdown: string): string {
  const lines = escapeHtml(markdown).split('\n');
  return lines.map((line) => {
    if (line.startsWith('# ')) return `<h1>${line.slice(2)}</h1>`;
    if (line.startsWith('## ')) return `<h2>${line.slice(3)}</h2>`;
    if (line.startsWith('### ')) return `<h3>${line.slice(4)}</h3>`;
    if (line.startsWith('- ')) return `<p class="bullet">${line.slice(2)}</p>`;
    if (!line.trim()) return '<br />';
    return `<p>${line}</p>`;
  }).join('');
}

function trimForDocument(value: string): string {
  const cleaned = value.replace(/\s+/g, ' ').trim();
  return cleaned.length > 900 ? `${cleaned.slice(0, 897)}...` : cleaned;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong.';
}

function formatApiError(message: string, details?: string[]): string {
  const cleanDetails = (details || []).filter(Boolean);
  return cleanDetails.length ? `${message} ${cleanDetails.join(' ')}` : message;
}

function setRecordingStatus(target: RecordingTarget, message: string, isError = false): void {
  const status = getOptional(`${target}-recording-status`);
  if (!status) return;
  status.textContent = message;
  status.className = `form-message${isError ? ' is-error' : ''}`;
}

function getElement<T extends HTMLElement = HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing element: ${id}`);
  }
  return element as T;
}

function getOptional<T extends HTMLElement = HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
