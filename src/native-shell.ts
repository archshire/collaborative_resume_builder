import './styles.css';
import './native-shell.css';
import landingImage from '../assets/landing_page.png';
import workspaceImage from '../assets/build_page.png';
import { credentials, acceptsDemoLogin, approveMaterial, applicantTurns } from './demo-access';
import type { DemoRole, Requirement, ApprovedMaterial } from './demo-access';
import { applicantDemo } from './applicant-demo';
import { companyCandidates } from './company-demo';
import type { CompanyCandidate, CompanyEvidenceStatus } from './company-demo';

const root = document.querySelector<HTMLDivElement>('#app')!;
const escape = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));
let role: DemoRole = location.pathname.startsWith('/company') ? 'company' : 'applicant';
const signedIn = { applicant: false, company: false };
type Tab = 'opportunity' | 'applicant' | 'assessment' | 'interview' | 'outputs' | 'followup' | 'sharing' | 'evaluation';
let tab: Tab = 'opportunity';
let practiceTab: Tab = 'opportunity';
let approved: ApprovedMaterial | null = null;
let requirementList: Requirement[] = [];
let analysisSource = '';
let requirementsVersion = 0;
const evaluations: Record<number, { status: string; note: string; version: number; requirementsVersion: number }> = {};
const evaluationDrafts: Record<number, { status: string; note: string }> = {};
let analysisBusy = false;
let companyDemoActive = false;
const companyAssessments: Record<string, { status: string; note: string }> = {};

root.innerHTML = `<div class="crb-frame"><header class="crb-top"><a href="/applicant" data-role="applicant" class="crb-logo"><svg class="crb-logo-mark" viewBox="0 0 48 48" role="img" aria-label="CRB contribution mark"><defs><linearGradient id="crb-mark-gradient" x1="5" y1="4" x2="43" y2="44" gradientUnits="userSpaceOnUse"><stop stop-color="#2f6fd0"/><stop offset="1" stop-color="#0d8a82"/></linearGradient></defs><rect x="2" y="2" width="44" height="44" rx="13" fill="url(#crb-mark-gradient)"/><circle cx="16" cy="17" r="4" fill="white"/><circle cx="32" cy="15" r="4" fill="white"/><circle cx="29" cy="32" r="4" fill="white"/><path d="M19.5 16.5 28 15.5M18.5 20.5 26.5 29M31.5 19 29.5 28" stroke="white" stroke-width="2.5" stroke-linecap="round"/></svg><span class="crb-logo-copy"><strong>CRB</strong><small>Collaborative Resume (Contribution) Builder</small></span></a><nav aria-label="Demo accounts"><a href="/applicant" data-role="applicant">Applicant</a><a href="/company" data-role="company">Company</a></nav><button id="profile-tab" data-tab="applicant" class="ghost" hidden>Profile</button><button id="logout" class="ghost" hidden>Log out</button></header>
  <aside class="crb-sidebar"><p class="eyebrow" id="workspace-label"></p><nav id="left-tabs" aria-label="Workspace navigation"></nav><p class="note">Understand the need.<br>Develop the capability.<br>Demonstrate the contribution.</p><p class="crb-demo-note">Demo access only. Work stays in this tab until refresh.</p><a href="/interview" target="_blank" rel="noopener">Full original interview ↗</a></aside>
  <div class="crb-content"><section id="login-panel" class="panel"></section><div id="ai-configuration" class="crb-ai-status" role="status" hidden></div><div id="interview-app" hidden></div><section id="sharing-panel" class="panel" hidden></section><section id="evaluation-panel" class="panel" hidden></section></div></div>`;
root.style.setProperty('--landing-image', `url("${landingImage}")`);
root.style.setProperty('--workspace-image', `url("${workspaceImage}")`);
const original = await import('./main');
original.useLiveOpportunity();
const element = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const shell = document.querySelector<HTMLElement>('#interview-app > .shell')!;
const context = shell.querySelector<HTMLElement>('.context-panel')!;
const initialWorkspace = shell.querySelector<HTMLElement>('.workspace:not(.followup-workspace)')!;
const outputs = shell.querySelector<HTMLElement>('.outputs:not(.followup-outputs)')!;
const followupWorkspace = shell.querySelector<HTMLElement>('.followup-workspace')!;
const followupOutputs = shell.querySelector<HTMLElement>('.followup-outputs')!;
const masthead = shell.querySelector<HTMLElement>('.masthead')!;
masthead.querySelector('.brand-title')!.textContent = 'CRB';
masthead.querySelector('.hero-line')!.textContent = 'Understand the need. Demonstrate your contribution.';
const part1 = shell.querySelector<HTMLElement>('.part-heading-row')!;
const part2 = shell.querySelector<HTMLElement>(':scope > .part-heading')!;
part1.querySelector('.part-heading')!.textContent = 'Part 1 Interview';
// Reuse the original DOM and its event handlers. Remove preset entry points from the live demo.
for (const id of ['context-preset', 'context-custom', 'questions-preset', 'questions-custom', 'questions-cut-to-chase', 'load-sample']) element(id).hidden = true;
element('preset-context-content').replaceChildren();
element('preset-question-list').replaceChildren();
context.querySelector('h2')!.textContent = 'YOUR OPPORTUNITY';
element('job-url-input').closest('.job-url-import')!.insertAdjacentHTML('afterend', '<p class="note">Import a link or document above, or paste the job description below. Then choose Understand the role or Generate interview questions.</p>');
element<HTMLInputElement>('job-url-input').placeholder = 'Paste a real job URL';
element<HTMLTextAreaElement>('custom-company').rows = 3;
element<HTMLTextAreaElement>('custom-job-description').placeholder = 'Paste a job description here, or extract one from a URL above.';
element<HTMLTextAreaElement>('custom-questions').placeholder = 'Your AI-generated questions will appear here. You can edit them.';
context.insertAdjacentHTML('beforeend', `<div class="crb-context-actions"><button class="secondary" id="understand-role">Understand the role with AI</button><button class="primary" id="prepare-questions">Generate interview questions →</button></div><p id="opportunity-action-status" role="status" class="note"></p><div id="opportunity-analysis"></div>`);
initialWorkspace.querySelector('.recorder-panel h2')!.innerHTML = '<span class="section-icon" aria-hidden="true">📼</span> ANSWER OR RECORD';
const quickAnswer = document.createElement('section');
quickAnswer.className = 'crb-quick-answer';
quickAnswer.innerHTML = `<h3>Your answer</h3><p class="note">Choose one useful question. Type a few sentences, or use Part 1 Interview to record your answer. You do not need to answer every question.</p><label for="quick-answer">What did you personally do, and what happened?</label><textarea id="quick-answer" rows="4" maxlength="12000" placeholder="One example that comes to mind…"></textarea><div class="crb-context-actions"><button id="add-answer" class="primary">Add to my transcript</button><button id="organise-answer" class="ghost">Let AI organise this answer</button></div><p id="answer-status" class="note" role="status"></p><div id="answer-excerpts"></div>`;
initialWorkspace.querySelector('.question-guide')!.after(quickAnswer);
// Questions come before the recorder; audio stays available as an alternative, not a prerequisite.
const recorderPanel = initialWorkspace.querySelector('.recorder-panel')!;
const questionGuide = initialWorkspace.querySelector('.question-guide')!;
recorderPanel.prepend(quickAnswer); recorderPanel.prepend(questionGuide);
const recruiterLabel = element('recruiter-name').closest('label')!;
recruiterLabel.hidden = true;
element<HTMLInputElement>('recruiter-name').value = 'Self-assessment';
element<HTMLInputElement>('applicant-name').value = 'Applicant';
const together = document.createElement('label'); together.className = 'crb-checkbox'; together.innerHTML = '<input type="checkbox" id="together" /> Interviewing with another person';
recorderPanel.querySelector('.identity-grid')!.before(together);
element<HTMLInputElement>('together').onchange = e => { const checked = (e.target as HTMLInputElement).checked; recruiterLabel.hidden = !checked; element<HTMLInputElement>('recruiter-name').value = checked ? '' : 'Self-assessment'; };
// The active demo does not present AI percentages as a suitability measure.
outputs.querySelector('.profile-output')?.classList.add('crb-legacy-skill-profile');
followupOutputs.querySelector('.profile-output')?.classList.add('crb-legacy-skill-profile');
const applicantPanel = document.createElement('section');
applicantPanel.className = 'panel crb-applicant-panel';
applicantPanel.innerHTML = '<h2>Profile</h2><p class="note">Add what is useful now. You can return to these optional details later.</p>';
applicantPanel.append(initialWorkspace.querySelector('.applicant-direct-section')!);
const { mountResumeImport } = await import('./resume-import');
mountResumeImport(applicantPanel);
shell.append(applicantPanel);
initialWorkspace.querySelector('.transcript-panel h2')!.textContent = 'Your transcript & supporting information';
const finalStage = document.createElement('section'); finalStage.className = 'crb-final-stage';
shell.append(finalStage);
const draftPanel = outputs.querySelector<HTMLElement>('.resume-output')!;
const feedbackPanel = outputs.querySelector<HTMLElement>('.feedback-output')!;
const assessmentPanel = document.createElement('section'); assessmentPanel.className = 'panel crb-assessment-panel';
assessmentPanel.innerHTML = '<h2>Self-assessment</h2><p class="note">Start with one example. Your answers carry forward into the interview and initial profile.</p>';
assessmentPanel.append(questionGuide, quickAnswer); shell.append(assessmentPanel);
const interviewGuide = document.createElement('details'); interviewGuide.className = 'crb-interview-guide'; interviewGuide.open = true;
interviewGuide.innerHTML = '<summary>Interview questions</summary><div id="interview-question-reference" class="crb-preserve"></div>';
recorderPanel.prepend(interviewGuide);
const syncQuestionReference = () => { element('interview-question-reference').textContent = element<HTMLTextAreaElement>('custom-questions').value.trim() || 'Generate or add questions under Self-assessment. You can also begin with your own questions.'; };
element('custom-questions').addEventListener('input', syncQuestionReference);
document.addEventListener('crb:questions-changed', syncQuestionReference); syncQuestionReference();
// Spoken questions with voice or typed answers. The recorder below stays available for a free-form interview.
const { mountGuidedInterview } = await import('./guided-interview');
const guidedHost = document.createElement('div');
interviewGuide.after(guidedHost);
mountGuidedInterview(guidedHost, {
  questions: () => element<HTMLTextAreaElement>('custom-questions').value,
  applicantName: () => element<HTMLInputElement>('applicant-name').value.trim() || 'Applicant',
  onAnswer: (question, answer) => original.addGuidedExchange(question, answer),
});

const nodes: Record<string, HTMLElement[]> = { opportunity: [context], applicant: [applicantPanel], assessment: [assessmentPanel], interview: [part1, initialWorkspace], outputs: [outputs], followup: [part2, feedbackPanel, followupWorkspace], sharing: [finalStage] };
const tabsFor = () => role === 'applicant' ? [['opportunity', '01', 'Job Opportunity'], ['assessment', '02', 'Self-assessment'], ['interview', '03', 'Part 1 Interview'], ['outputs', '04', 'Generate Initial Profile'], ['followup', '05', 'Part 2 – Feedback and Follow-up'], ['sharing', '06', 'Full Resume']] : [['opportunity', '01', 'Role & requirements'], ['evaluation', '02', 'Review application']];
const descriptions: Record<string, string> = { opportunity: 'Job description and target role', applicant: 'Profile, contact and qualifications', assessment: 'Reflect and answer in text', interview: 'Record, upload and review your transcript', outputs: 'Resume draft and capability evidence', followup: 'Clarify gaps with another example', sharing: 'Review, export and approve sharing', evaluation: 'Applicant-approved evidence' };
const stepFooter = document.createElement('div'); stepFooter.className = 'crb-step-footer';
element('evaluation-panel').after(stepFooter);

function drawLogin() {
  const login = credentials[role];
  element('login-panel').innerHTML = `<div class="crb-login-fields"><p class="eyebrow">Collaborative Resume (Contribution) Builder</p><h1>${role === 'applicant' ? 'Build a resume for the contribution you can make.' : 'Understand the contribution an applicant can make.'}</h1><p>${role === 'applicant' ? 'Start with a real opportunity. Choose one useful question—you don’t need to answer everything.' : 'Confirm the role’s needs and review applicant-approved evidence.'}</p><form id="login-form"><label for="login-name">Login name</label><input id="login-name" placeholder="${login.name}" autocomplete="off" /><label for="login-password">Password</label><input id="login-password" type="password" placeholder="${login.password}" autocomplete="off" /><p class="note">Demo login: <strong>${login.name} / ${login.password}</strong>. This is not a secure account system.</p><p id="login-error" role="alert"></p><button class="primary" type="submit">Enter ${role === 'applicant' ? 'applicant' : 'company'} workspace</button></form><div class="crb-one-click-demo"><span>or</span>${role === 'applicant' ? '<button id="completed-applicant-demo" class="demo-launch" type="button">▶ Try the completed applicant demo</button><button id="completed-company-demo" class="demo-launch company-launch" type="button">🏢 View the company demo</button><p>Explore completed fictional applications based on a real SUTD opportunity.</p>' : '<button id="completed-company-demo" class="demo-launch company-launch" type="button">🏢 View three candidates</button><p>Open the completed fictional company review without entering credentials.</p>'}</div></div>`;
  element('login-form').onsubmit = e => { e.preventDefault(); if (!acceptsDemoLogin(role, element<HTMLInputElement>('login-name').value, element<HTMLInputElement>('login-password').value)) { element('login-error').textContent = `Use ${login.name} / ${login.password} for this demo.`; return; } signedIn[role] = true; draw(); };
  const demoButton = document.getElementById('completed-applicant-demo');
  if (demoButton) demoButton.onclick = () => loadApplicantDemo();
  const companyDemoButton = document.getElementById('completed-company-demo');
  if (companyDemoButton) companyDemoButton.onclick = () => loadCompanyDemo();
}
function loadApplicantDemo() {
  original.loadCompletedApplicantDemo(applicantDemo);
  requirementList = applicantDemo.requirements.map(requirement => ({ ...requirement }));
  analysisSource = sourceKey();
  requirementsVersion++;
  element('opportunity-analysis').innerHTML = `<div class="crb-demo-banner"><strong>Completed fictional applicant demo</strong><span>Daniel Tan is a moderately matched example. Edit any field or use the live AI buttons to explore.</span></div><h3>What the organisation needs</h3><p>${escape(applicantDemo.summary)}</p><p class="note">Stated requirements come from the job posting. Interpretations still need employer confirmation.</p>${requirementList.map((r, i) => `<div class="crb-requirement"><label for="requirement-${i}">${r.basis === 'stated' ? 'Stated in the job posting' : 'AI interpretation · needs confirmation'}</label><textarea id="requirement-${i}" data-requirement="${i}" rows="2" maxlength="600">${escape(r.text)}</textarea>${r.sourceQuote ? `<details><summary>Source excerpt</summary><blockquote>${escape(r.sourceQuote)}</blockquote></details>` : ''}</div>`).join('')}`;
  element('opportunity-action-status').textContent = 'Completed demo loaded. All information remains editable.';
  renderEvidenceCoverage('candidate-profile-output', applicantDemo.initialEvidence, 'Initial evidence coverage');
  renderEvidenceCoverage('updated-candidate-profile-output', applicantDemo.updatedEvidence, 'Evidence coverage after follow-up');
  signedIn.applicant = true;
  tab = 'opportunity';
  draw();
}
function loadCompanyDemo() {
  original.loadCompletedApplicantDemo(applicantDemo);
  requirementList = applicantDemo.requirements.map(requirement => ({ ...requirement }));
  analysisSource = sourceKey();
  requirementsVersion++;
  companyDemoActive = true;
  role = 'company';
  signedIn.company = true;
  tab = 'evaluation';
  history.pushState({}, '', '/company');
  draw();
}
type EvidenceStatus = 'supported' | 'partial' | 'self-reported' | 'none';
type EvidenceItem = { requirement: string; status: string; excerpt: string };
const evidenceMeta: Record<EvidenceStatus, { label: string; points: number }> = {
  supported: { label: 'Supported by examples', points: 1 },
  partial: { label: 'Partially supported', points: 0.5 },
  'self-reported': { label: 'Self-reported', points: 0 },
  none: { label: 'No evidence yet', points: 0 },
};
function evidenceLegend(counts?: Record<EvidenceStatus, number>): string {
  return `<div class="coverage-legend-block" aria-label="Evidence status colour legend"><strong>Evidence status legend</strong><div class="coverage-legend">${Object.entries(evidenceMeta).map(([status, meta]) => `<span><i class="coverage-${status}"></i>${meta.label}${counts ? ` <strong>${counts[status as EvidenceStatus]}</strong>` : ''}</span>`).join('')}</div></div>`;
}
function renderEvidenceCoverage(outputId: string, source: readonly EvidenceItem[], title: string) {
  const output = element(outputId);
  const panel = output.closest<HTMLElement>('article')!;
  const chartId = `${outputId}-coverage`;
  panel.querySelector(`#${chartId}`)?.remove();
  const chart = document.createElement('section');
  chart.id = chartId;
  chart.className = 'evidence-coverage';
  chart.setAttribute('aria-label', title);
  const statuses = source.map(item => item.status as EvidenceStatus);
  const drawChart = () => {
    const counts = Object.fromEntries(Object.keys(evidenceMeta).map(status => [status, statuses.filter(value => value === status).length])) as Record<EvidenceStatus, number>;
    const points = statuses.reduce((sum, status) => sum + evidenceMeta[status].points, 0);
    const percentage = Math.round((points / source.length) * 100);
    chart.innerHTML = `${evidenceLegend(counts)}<div class="evidence-heading"><div><p class="eyebrow">${escape(title)}</p><strong>${percentage}% evidence coverage</strong><p>${points} of ${source.length} requirement points currently have supporting evidence.</p></div><div class="coverage-score" aria-label="${percentage} percent">${percentage}<span>%</span></div></div><div class="coverage-bar" role="img" aria-label="${Object.entries(evidenceMeta).map(([status, meta]) => `${meta.label}: ${counts[status as EvidenceStatus]}`).join(', ')}">${Object.entries(evidenceMeta).map(([status]) => `<span class="coverage-${status}" style="width:${counts[status as EvidenceStatus] / source.length * 100}%"></span>`).join('')}</div><p class="coverage-note">This measures evidence supplied against the role requirements. It is not a prediction of performance or a hiring recommendation.</p><div class="evidence-items">${source.map((item, index) => `<details><summary><span>${escape(item.requirement)}</span><strong class="status-${statuses[index]}">${escape(evidenceMeta[statuses[index]].label)}</strong></summary><p>${escape(item.excerpt)}</p><label for="${chartId}-status-${index}">Correct this evidence classification</label><select id="${chartId}-status-${index}" data-evidence-index="${index}">${Object.entries(evidenceMeta).map(([status, meta]) => `<option value="${status}" ${statuses[index] === status ? 'selected' : ''}>${meta.label}</option>`).join('')}</select></details>`).join('')}</div>`;
    chart.querySelectorAll<HTMLSelectElement>('[data-evidence-index]').forEach(select => select.onchange = () => { statuses[Number(select.dataset.evidenceIndex)] = select.value as EvidenceStatus; drawChart(); });
  };
  drawChart();
  output.before(chart);
}
function draw() {
  root.querySelector('.crb-frame')!.classList.toggle('is-landing', !signedIn[role]);
  root.querySelector<HTMLElement>('.crb-sidebar')!.hidden = !signedIn[role];
  // Move existing controls without recreating their state or handlers.
  outputs.prepend(draftPanel);
  shell.insertBefore(feedbackPanel, followupWorkspace);
  followupOutputs.hidden = true;
  if (tab === 'sharing') {
    if (original.currentInterview().followup.trim().length > 40) { finalStage.append(followupOutputs); followupOutputs.hidden = false; }
    else finalStage.append(draftPanel);
  }
  const steps = tabsFor(); const index = steps.findIndex(step => step[0] === tab);
  stepFooter.hidden = !signedIn[role];
  element('profile-tab').hidden = !signedIn[role] || role !== 'applicant';
  element('profile-tab').setAttribute('aria-pressed', String(tab === 'applicant'));
  element('profile-tab').onclick = () => show(tab === 'applicant' ? practiceTab : 'applicant');
  stepFooter.innerHTML = `${index > 0 ? '<button class="ghost" data-step="back">Back</button>' : '<span></span>'}${index < steps.length - 1 ? '<button class="primary" data-step="next">Continue →</button>' : ''}`;
  stepFooter.querySelector<HTMLButtonElement>('[data-step="back"]')?.addEventListener('click', () => show(steps[index - 1][0] as Tab));
  stepFooter.querySelector<HTMLButtonElement>('[data-step="next"]')?.addEventListener('click', () => show(steps[index + 1][0] as Tab));
  if (tab === 'applicant') {
    stepFooter.innerHTML = '<button class="primary" id="return-to-practice">Return to practice →</button>';
    element('return-to-practice').onclick = () => show(practiceTab);
  }
  element('workspace-label').textContent = role === 'applicant' ? 'Applicant workspace' : 'Company workspace';
  document.querySelectorAll<HTMLAnchorElement>('[data-role]').forEach(a => a.setAttribute('aria-current', a.dataset.role === role ? 'page' : 'false'));
  element('left-tabs').innerHTML = tabsFor().map(([id, number, label]) => `<button data-tab="${id}" ${tab === id ? 'aria-current="page"' : ''} ${!signedIn[role] ? 'disabled' : ''}><span class="crb-step-number">${number}</span><span class="crb-step-label"><strong>${label}</strong><small>${descriptions[id]}</small></span></button>`).join('');
  element('left-tabs').querySelectorAll<HTMLButtonElement>('[data-tab]').forEach(b => b.onclick = () => show(b.dataset.tab as Tab));
  element('login-panel').hidden = signedIn[role];
  element('logout').hidden = !signedIn[role];
  element('interview-app').hidden = !signedIn[role] || tab === 'evaluation';
  masthead.hidden = true;
  shell.querySelector<HTMLElement>('.session-footer')!.hidden = true;
  Object.entries(nodes).forEach(([key, entries]) => entries.forEach(node => node.hidden = !signedIn[role] || key !== tab));
  element('sharing-panel').hidden = !signedIn[role] || tab !== 'sharing';
  element('evaluation-panel').hidden = !signedIn[role] || tab !== 'evaluation';
  if (!signedIn[role]) drawLogin();
  if (signedIn[role] && tab === 'sharing') drawSharing();
  if (signedIn[role] && tab === 'followup') element<HTMLButtonElement>('followup-ready').click();
  if (signedIn[role] && tab === 'evaluation') drawEvaluation();
  document.title = `${role === 'applicant' ? 'Applicant' : 'Company'} · CRB`;
}
function show(next: Tab) {
  // Preserve the original fields, answers and recording objects when navigating.
  if (next !== tab) original.stopActiveCapture();
  if (next === 'applicant' && tab !== 'applicant') practiceTab = tab;
  tab = next; draw(); window.scrollTo(0, 0);
}
function switchRole(next: DemoRole, push = true) {
  original.stopActiveCapture(); role = next; tab = 'opportunity';
  if (push) history.pushState({}, '', `/${next}`);
  draw();
}
document.querySelectorAll<HTMLAnchorElement>('[data-role]').forEach(link => link.onclick = e => { if (e.metaKey || e.ctrlKey || e.shiftKey) return; e.preventDefault(); switchRole(link.dataset.role as DemoRole); });
element('logout').onclick = () => { original.stopActiveCapture(); signedIn[role] = false; draw(); };
window.addEventListener('popstate', () => switchRole(location.pathname.startsWith('/company') ? 'company' : 'applicant', false));

async function api(path: string, body: unknown): Promise<any> {
  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 90000);
  try {
    const response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Resume-Client': '1' }, body: JSON.stringify(body), signal: controller.signal });
    const result = await response.json();
    if (!response.ok) throw new Error([result.error || 'The AI request failed. Please try again.', ...(Array.isArray(result.details) ? result.details.filter((value: unknown) => typeof value === 'string') : [])].join(' '));
    return result;
  } finally { clearTimeout(timeout); }
}
const sourceKey = () => { const current = original.currentInterview(); return JSON.stringify([current.company, current.jobDescription]); };
function opportunityChanged() {
  if (analysisSource && analysisSource !== sourceKey()) { requirementList = []; analysisSource = ''; requirementsVersion++; element('opportunity-analysis').replaceChildren(); }
  element('opportunity-action-status').textContent = 'Review the job information below, then generate questions or ask AI to explain the role.';
  const current = original.currentInterview();
  element<HTMLButtonElement>('prepare-questions').disabled = !current.jobDescription;
  element<HTMLButtonElement>('understand-role').disabled = !current.jobDescription || analysisBusy;
}
for (const id of ['custom-company', 'custom-job-description']) element(id).addEventListener('input', opportunityChanged);
document.addEventListener('crb:opportunity-changed', opportunityChanged);
element('prepare-questions').onclick = () => { show('assessment'); element<HTMLButtonElement>('generate-custom-questions').click(); };
element('understand-role').onclick = async () => {
  if (analysisBusy) return;
  const current = original.currentInterview(); const before = sourceKey();
  if (!current.jobDescription) return;
  analysisBusy = true; element<HTMLButtonElement>('understand-role').disabled = true; element('opportunity-action-status').textContent = 'AI is identifying the role’s tasks, outcomes and skills…';
  try {
    const result = await api('/api/understand-opportunity', { company: current.company, jobDescription: current.jobDescription });
    if (sourceKey() !== before) throw new Error('The job information changed. Please analyse the updated description.');
    requirementList = result.requirements; analysisSource = before; requirementsVersion++;
    element('opportunity-analysis').innerHTML = `<h3>What the organisation needs</h3><p>${escape(result.summary)}</p><p class="note">Review these suggestions. Interpretations are not employer-confirmed requirements.</p>${requirementList.map((r, i) => `<div class="crb-requirement"><label for="requirement-${i}">${r.basis === 'stated' ? 'Stated in the job posting' : 'AI interpretation · needs confirmation'}</label><textarea id="requirement-${i}" data-requirement="${i}" rows="2" maxlength="600">${escape(r.text)}</textarea>${r.sourceQuote ? `<details><summary>Source excerpt</summary><blockquote>${escape(r.sourceQuote)}</blockquote></details>` : ''}</div>`).join('')}`;
    element('opportunity-analysis').querySelectorAll<HTMLTextAreaElement>('[data-requirement]').forEach(input => input.oninput = () => { requirementList[Number(input.dataset.requirement)].text = input.value; requirementsVersion++; });
    element('opportunity-action-status').textContent = 'AI analysis complete. You can correct every requirement.';
  } catch (error) { element('opportunity-action-status').textContent = error instanceof Error ? error.message : 'Analysis failed. Your job description is still available.'; }
  finally { analysisBusy = false; element<HTMLButtonElement>('understand-role').disabled = !original.currentInterview().jobDescription; }
};
element('add-answer').onclick = () => { const input = element<HTMLTextAreaElement>('quick-answer'); if (!input.value.trim()) return; original.addApplicantAnswer(input.value); input.value = ''; element('answer-excerpts').replaceChildren(); element('answer-status').textContent = 'Added to your editable transcript. You can continue with another example or generate a resume.'; };
element('organise-answer').onclick = async () => {
  const input = element<HTMLTextAreaElement>('quick-answer'); const text = input.value;
  if (!text.trim()) { element('answer-status').textContent = 'Type an answer first. A few sentences are enough.'; return; }
  const button = element<HTMLButtonElement>('organise-answer'); button.disabled = true; element('answer-status').textContent = 'AI is selecting the situation, action and outcome from your words…';
  try {
    const result = await api('/api/reflect-answer', { answer: text, question: 'What did you personally do, and what happened?' });
    if (input.value !== text) { element('answer-status').textContent = 'Your answer changed during the request. Organise it again when ready.'; return; }
    element('answer-excerpts').innerHTML = [['Situation', result.excerpts.situationQuote], ['Action', result.excerpts.actionQuote], ['Outcome', result.excerpts.outcomeQuote]].map(([label, quote]) => `<p><strong>${label}:</strong> ${escape(quote || 'Not stated in this answer.')}</p>`).join('');
    element('answer-status').textContent = 'Review the selected excerpts. Your original answer has not been changed.';
  } catch { element('answer-status').textContent = 'AI organisation is unavailable. Your answer is intact and can be added to the transcript as it is.'; }
  finally { button.disabled = false; }
};
element('quick-answer').oninput = () => element('answer-excerpts').replaceChildren();
let sharingDraft = '';
function drawSharing() {
  const current = original.currentInterview();
  element('sharing-panel').innerHTML = `<h2>APPLICATION PREVIEW</h2><p>Select the examples the company should see. Nothing is shared automatically.</p><button class="secondary" id="copy-applicant-turns">Start from my applicant answers</button><label for="share-text">Applicant-approved examples</label><textarea id="share-text" rows="10" placeholder="Choose or edit the specific examples to include…">${escape(sharingDraft)}</textarea><p class="note">Only this text, your applicant name and the current opportunity are included. Other transcript content and recordings remain private.</p><button class="primary" id="approve-material">Approve for company demo</button><button class="ghost" id="withdraw-material" ${!approved ? 'disabled' : ''}>Withdraw</button><p id="sharing-status" role="status"></p>`;
  element('copy-applicant-turns').onclick = () => { sharingDraft = applicantTurns(`${current.transcript}\n${current.followup}`, current.name); element<HTMLTextAreaElement>('share-text').value = sharingDraft; };
  element('share-text').oninput = e => sharingDraft = (e.target as HTMLTextAreaElement).value;
  element('approve-material').onclick = () => {
    if (!sharingDraft.trim() || !current.jobDescription) { element('sharing-status').textContent = 'Add a job description and at least one example before approving.'; return; }
    approved = approveMaterial(current.name, sharingDraft, current.company, current.jobDescription, (approved?.version || 0) + 1);
    element('sharing-status').textContent = 'The company demo can now see this approved snapshot in this tab.'; element<HTMLButtonElement>('withdraw-material').disabled = false;
  };
  element('withdraw-material').onclick = () => { approved = null; element('sharing-status').textContent = 'Withdrawn. Your private answers have been kept.'; element<HTMLButtonElement>('withdraw-material').disabled = true; };
}
function drawEvaluation() {
  const panel = element('evaluation-panel');
  if (companyDemoActive) { drawCompanyCandidates(panel); return; }
  if (!approved) { panel.innerHTML = '<h2>REVIEW APPLICATION</h2><p>No applicant-approved material yet. The applicant can choose examples in Application preview. No sample candidate has been inserted.</p>'; return; }
  const current = original.currentInterview();
  const sameRole = approved.jobDescription === current.jobDescription && approved.company === current.company;
  panel.innerHTML = `<h2>${escape(approved.name)} · approved application</h2><p>${escape(approved.company)}</p><details><summary>Job description approved with this application</summary><p class="crb-preserve">${escape(approved.jobDescription)}</p></details><h3>Approved examples</h3><blockquote class="crb-preserve">${escape(approved.text)}</blockquote>${!sameRole ? '<p class="note">The opportunity has changed since approval. Ask the applicant to review the new role before assessing suitability.</p>' : requirementList.length ? `<p class="note">Confirm the role requirements and record your assessment. No AI suitability score or ranking is calculated.</p>${requirementList.map((r, i) => {
    const saved = evaluations[i];
    const draft = evaluationDrafts[i] || saved;
    return `<details class="crb-rubric" name="evaluation"><summary>${escape(r.text)}</summary><p class="note">Compare the approved examples above with this requirement. Missing evidence is not proof of inability.</p>${saved && (saved.version !== approved!.version || saved.requirementsVersion !== requirementsVersion) ? '<p>Application or requirements changed. Revisit this earlier assessment.</p>' : ''}<label for="status-${i}">Your assessment</label><select id="status-${i}">${['Not yet assessed', 'Needs clarification', 'Partially meets', 'Meets the expectation'].map(option => `<option ${draft?.status === option ? 'selected' : ''}>${option}</option>`).join('')}</select><label for="reason-${i}">Reason or question to clarify</label><textarea id="reason-${i}" rows="3">${escape(draft?.note || '')}</textarea><button class="secondary" data-save="${i}">Save assessment</button><p id="saved-${i}" role="status"></p></details>`;
  }).join('')}` : '<p>Use “Understand the role with AI” under Role & requirements to prepare the rubric for this opportunity.</p>'}`;
  requirementList.forEach((_r, i) => {
    if (!document.getElementById(`status-${i}`)) return;
    const saveDraft = () => { evaluationDrafts[i] = { status: element<HTMLSelectElement>(`status-${i}`).value, note: element<HTMLTextAreaElement>(`reason-${i}`).value }; };
    element(`status-${i}`).onchange = saveDraft; element(`reason-${i}`).oninput = saveDraft;
  });
  panel.querySelectorAll<HTMLButtonElement>('[data-save]').forEach(button => button.onclick = () => { const i = Number(button.dataset.save); const status = element<HTMLSelectElement>(`status-${i}`).value; const note = element<HTMLTextAreaElement>(`reason-${i}`).value.trim(); if (status !== 'Not yet assessed' && !note) { element(`saved-${i}`).textContent = 'Add a short reason so your assessment is understandable.'; return; } evaluations[i] = { status, note, version: approved!.version, requirementsVersion }; delete evaluationDrafts[i]; element(`saved-${i}`).textContent = 'Saved for this approved application.'; });
}
function evidencePercentage(candidate: CompanyCandidate): number {
  const points: Record<CompanyEvidenceStatus, number> = { supported: 1, partial: 0.5, 'self-reported': 0, none: 0 };
  return Math.round(candidate.evidence.reduce((sum, item) => sum + points[item.status], 0) / candidate.evidence.length * 100);
}
function drawCompanyCandidates(panel: HTMLElement) {
  panel.className = 'panel company-candidates';
  panel.innerHTML = `<div class="company-demo-heading"><div><p class="eyebrow">Company demonstration · fictional candidates</p><h2>Candidates under consideration</h2><p>${escape(applicantDemo.company)} · Practice-Track Faculty in Business and AI</p></div><span>${companyCandidates.length} candidates</span></div>${evidenceLegend()}<p class="coverage-note">Candidates are ordered alphabetically. Evidence coverage measures the supplied evidence against this role; it is not a performance prediction, ranking or hiring recommendation.</p><div class="candidate-card-grid">${companyCandidates.map(candidate => {
    const percentage = evidencePercentage(candidate);
    const counts = Object.fromEntries(Object.keys(evidenceMeta).map(status => [status, candidate.evidence.filter(item => item.status === status).length])) as Record<EvidenceStatus, number>;
    return `<article class="candidate-card"><div class="candidate-card-top"><div><h3>${escape(candidate.name)}</h3><p>${escape(candidate.headline)}</p></div><strong>${percentage}<span>%</span></strong></div><div class="coverage-bar" role="img" aria-label="${escape(candidate.name)}: ${percentage}% evidence coverage">${Object.keys(evidenceMeta).map(status => `<span class="coverage-${status}" style="width:${counts[status as EvidenceStatus] / candidate.evidence.length * 100}%"></span>`).join('')}</div><p class="candidate-contribution">${escape(candidate.contribution)}</p><button class="secondary" data-candidate="${candidate.id}">Review evidence</button></article>`;
  }).join('')}</div><div id="company-candidate-detail"></div>`;
  panel.querySelectorAll<HTMLButtonElement>('[data-candidate]').forEach(button => button.onclick = () => {
    const candidate = companyCandidates.find(item => item.id === button.dataset.candidate);
    if (candidate) drawCompanyCandidateDetail(candidate);
  });
}
function drawCompanyCandidateDetail(candidate: CompanyCandidate) {
  const detail = element('company-candidate-detail');
  detail.innerHTML = `<section class="candidate-detail"><div class="candidate-detail-heading"><div><p class="eyebrow">Candidate-approved application material</p><h2>${escape(candidate.name)}</h2><p>${escape(candidate.contribution)}</p></div><div class="coverage-score" aria-label="${evidencePercentage(candidate)} percent evidence coverage">${evidencePercentage(candidate)}<span>%</span></div></div><h3>Requirement evidence</h3><div class="evidence-items">${candidate.evidence.map((item, index) => `<details><summary><span>${escape(item.requirement)}</span><strong class="status-${item.status}">${escape(evidenceMeta[item.status].label)}</strong></summary><p>${escape(item.excerpt)}</p><label for="company-assessment-${candidate.id}-${index}">Human assessment</label><select id="company-assessment-${candidate.id}-${index}" data-company-status="${candidate.id}-${index}">${['Not yet assessed', 'Needs clarification', 'Partially meets', 'Meets the expectation'].map(option => `<option ${companyAssessments[`${candidate.id}-${index}`]?.status === option ? 'selected' : ''}>${option}</option>`).join('')}</select><label for="company-note-${candidate.id}-${index}">Reason or interview note</label><textarea id="company-note-${candidate.id}-${index}" rows="3" data-company-note="${candidate.id}-${index}">${escape(companyAssessments[`${candidate.id}-${index}`]?.note || '')}</textarea><button class="ghost" data-company-save="${candidate.id}-${index}">Save assessment</button><span class="assessment-saved" id="company-saved-${candidate.id}-${index}"></span></details>`).join('')}</div><div class="candidate-detail-columns"><section><h3>Development or evidence gaps</h3><ul>${candidate.gaps.map(gap => `<li>${escape(gap)}</li>`).join('')}</ul></section><section><h3>Suggested interview questions</h3><ol>${candidate.questions.map(question => `<li>${escape(question)}</li>`).join('')}</ol></section></div></section>`;
  detail.querySelectorAll<HTMLButtonElement>('[data-company-save]').forEach(button => button.onclick = () => {
    const key = button.dataset.companySave!;
    const status = detail.querySelector<HTMLSelectElement>(`[data-company-status="${key}"]`)!.value;
    const note = detail.querySelector<HTMLTextAreaElement>(`[data-company-note="${key}"]`)!.value.trim();
    const message = element(`company-saved-${key}`);
    if (status !== 'Not yet assessed' && !note) { message.textContent = ' Add a reason before saving.'; return; }
    companyAssessments[key] = { status, note }; message.textContent = ' Saved.';
  });
  detail.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
async function configurationStatus() {
  const panel = element('ai-configuration');
  try {
    const response = await fetch('/api/ai-status'); const status = await response.json();
    if (!status.configured) { panel.hidden = false; panel.textContent = 'Live AI needs a provider key. Add GEMINI_API_KEY or OPENAI_API_KEY to .env and restart the backend. Your job text and answers stay editable; sample results will not be substituted.'; }
  } catch { panel.hidden = false; panel.textContent = 'AI backend unavailable. Run npm run serve to use job extraction, transcription and generation.'; }
}
window.addEventListener('beforeunload', event => { const current = original.currentInterview(); if (current.transcript || current.jobDescription || element<HTMLTextAreaElement>('quick-answer').value) { event.preventDefault(); event.returnValue = ''; } });
original.useLiveOpportunity(); opportunityChanged(); draw(); void configurationStatus();
