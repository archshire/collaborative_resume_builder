import { test, expect, type Page } from '@playwright/test';
const jobText = 'Riverview Library is hiring a programme assistant. Responsibilities include organising reading groups, communicating with participants, and maintaining attendance records. Applicants should have experience coordinating activities and working with community groups.';
const generated = ['How did you organise a reading group?', 'How have you kept participants informed?', 'How do you check attendance records?', 'When did you adapt an activity?', 'How did you support a participant?', 'What did you learn from volunteering?', 'How did you resolve a scheduling issue?', 'What tools have you used for records?'];
async function login(page: Page, role = 'applicant') {
  await page.getByLabel('Login name', { exact: true }).fill(role);
  await page.getByLabel('Password', { exact: true }).fill(role === 'applicant' ? 'hireme' : 'rightfit');
  await page.getByRole('button', { name: `Enter ${role} workspace` }).click();
}
const nav = (page: Page, name: string) => page.getByRole('navigation', { name: 'Workspace navigation' }).getByRole('button', { name });

test('one-click company demo shows three unranked candidates with reviewable evidence', async ({ page }) => {
  await page.goto('/applicant');
  await page.getByRole('button', { name: 'View the company demo' }).click();
  await expect(page).toHaveURL(/\/company$/);
  await expect(page.locator('.candidate-card')).toHaveCount(3);
  await expect(page.locator('.candidate-card h3')).toHaveText(['Aisha Rahman', 'Daniel Tan', 'Marcus Lee']);
  await expect(page.locator('#evaluation-panel > .coverage-legend-block')).toContainText('Supported by examples');
  await expect(page.locator('#evaluation-panel > .coverage-legend-block')).toContainText('No evidence yet');
  await expect(page.locator('#evaluation-panel')).toContainText('not a performance prediction, ranking or hiring recommendation');
  await page.locator('.candidate-card').filter({ hasText: 'Daniel Tan' }).getByRole('button', { name: 'Review evidence' }).click();
  await expect(page.locator('#company-candidate-detail')).toContainText('Candidate-approved application material');
  await expect(page.locator('#company-candidate-detail')).toContainText('No semester-long university teaching evidence');
  const firstEvidence = page.locator('#company-candidate-detail details').first();
  await firstEvidence.click();
  await firstEvidence.locator('select').selectOption('Needs clarification');
  await firstEvidence.getByRole('button', { name: 'Save assessment' }).click();
  await expect(firstEvidence).toContainText('Add a reason before saving');
  await firstEvidence.locator('textarea').fill('Ask for a sample lesson and assessment rubric.');
  await firstEvidence.getByRole('button', { name: 'Save assessment' }).click();
  await expect(firstEvidence).toContainText('Saved');
});

test('one-click applicant demo fills the complete editable journey', async ({ page }) => {
  await page.goto('/applicant');
  await page.getByRole('button', { name: 'Try the completed applicant demo' }).click();
  await expect(page.locator('#custom-company')).toHaveValue(/Singapore University of Technology and Design/);
  await expect(page.locator('#job-url-input')).toHaveValue(/careers\.sutd\.edu\.sg/);
  await expect(page.locator('#opportunity-analysis')).toContainText('moderately matched example');
  await nav(page, 'Self-assessment').click();
  await expect(page.locator('#custom-questions')).toHaveValue(/^1\. What do you think SUTD/m);
  await nav(page, 'Part 1 Interview').click();
  await expect(page.locator('#transcript-editor')).toContainText('reduced average handling time from 14 to 9 minutes');
  await nav(page, 'Generate Initial Profile').click();
  await expect(page.locator('#resume-output')).toContainText('Transformation Lead');
  await expect(page.locator('#candidate-profile-output')).toContainText('CAPABILITIES SUPPORTED BY EXAMPLES');
  await expect(page.locator('#candidate-profile-output')).toContainText('SELF-REPORTED');
  const initialCoverage = page.locator('#candidate-profile-output-coverage');
  await expect(initialCoverage.locator('.coverage-legend-block')).toContainText('Evidence status legend');
  await expect(initialCoverage.locator('.coverage-legend-block')).toContainText('Partially supported 1');
  await expect(initialCoverage).toContainText('58% evidence coverage');
  await expect(initialCoverage.locator('.coverage-legend')).toContainText('Supported by examples 3');
  await initialCoverage.locator('details').first().click();
  await initialCoverage.locator('select').first().selectOption('supported');
  await expect(initialCoverage).toContainText('67% evidence coverage');
  await nav(page, 'Part 2').click();
  await expect(page.locator('#feedback-output')).toContainText('semester-long teaching');
  await expect(page.locator('#followup-transcript-editor')).toContainText('grading rubric');
  await nav(page, 'Full Resume').click();
  await expect(page.locator('#updated-resume-output')).toContainText('DEVELOPMENT PLAN');
  await expect(page.locator('#updated-candidate-profile-output')).toContainText('Candidate Profile After Follow-up');
  await expect(page.locator('#updated-candidate-profile-output')).toContainText('did not itself demonstrate newly acquired');
  await expect(page.locator('#updated-candidate-profile-output-coverage')).toContainText('83% evidence coverage');
  await page.getByRole('button', { name: 'Profile', exact: true }).click();
  await expect(page.locator('#applicant-info-name')).toHaveValue('Daniel Tan');
  await expect(page.locator('[data-label="Education"]')).toHaveValue(/MBA/);
});

test('original panel design with left tabs, empty real opportunity and demo account switching', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/applicant');
  await expect(page.getByLabel('Login name', { exact: true })).toHaveAttribute('placeholder', 'applicant');
  await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('placeholder', 'hireme');
  await login(page);
  await expect(page.locator('#custom-company')).toHaveValue('');
  await expect(page.locator('#custom-job-description')).toHaveValue('');
  await expect(page.locator('.context-panel')).toBeVisible();
  await expect(nav(page, 'Self-assessment')).toBeVisible();
  await page.getByRole('navigation', { name: 'Demo accounts' }).getByRole('link', { name: 'Company' }).click();
  await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('placeholder', 'rightfit');
  await login(page, 'company'); await nav(page, 'Review application').click();
  await expect(page.locator('#evaluation-panel')).toContainText('No applicant-approved material yet');
  await expect(page.locator('body')).not.toContainText('Northstar');
  expect(errors).toEqual([]);
});

test('real URL integration populates editable original fields and sends corrected context to question AI', async ({ page }) => {
  await page.route('**/api/extract-job-url', async route => {
    expect(route.request().postDataJSON().url).toBe('https://careers.example.org/library');
    expect(route.request().headers()['x-resume-client']).toBe('1');
    await route.fulfill({ json: { status: 'ok', company: 'Riverview Library', jobDescription: jobText, provider: 'test' } });
  });
  await page.route('**/api/generate-interview-questions', async route => {
    expect(route.request().postDataJSON().company).toBe('Riverview Community Library');
    expect(route.request().postDataJSON().jobDescription).toContain('reading groups');
    await route.fulfill({ json: { questions: generated, provider: 'test' } });
  });
  await page.goto('/applicant'); await login(page);
  await page.locator('#job-url-input').fill('https://careers.example.org/library');
  await page.locator('#extract-job-url').click();
  await expect(page.locator('#custom-job-description')).toHaveValue(jobText);
  await page.locator('#custom-company').fill('Riverview Community Library');
  await page.locator('#prepare-questions').click();
  await expect(page.locator('#custom-questions')).toHaveValue(/How did you organise a reading group/);
  await nav(page, 'Part 1 Interview').click();
  await expect(page.locator('#interview-question-reference')).toContainText('How did you organise a reading group');
  await nav(page, 'Self-assessment').click();
  await page.getByLabel('What did you personally do, and what happened?').fill('I organised reading groups for ten neighbours.');
  await page.getByRole('button', { name: 'Add to my transcript' }).click();
  await expect(page.locator('#transcript-editor')).toContainText('Applicant: I organised reading groups');
  await nav(page, 'Job Opportunity').click();
  await expect(page.locator('#custom-company')).toHaveValue('Riverview Community Library');
  await nav(page, 'Self-assessment').click();
  await expect(page.locator('#transcript-editor')).toContainText('ten neighbours');
});

test('pasted job calls AI extraction and real requirements create the company rubric without exposing private material', async ({ page }) => {
  await page.route('**/api/extract-job-document', async route => {
    expect(route.request().postDataJSON().text).toBe(jobText);
    await route.fulfill({ json: { status: 'ok', company: 'Riverview Library', jobDescription: jobText } });
  });
  await page.route('**/api/understand-opportunity', async route => {
    expect(route.request().postDataJSON().jobDescription).toBe(jobText);
    await route.fulfill({ json: { summary: 'Run useful reading groups.', requirements: [{ text: 'Organise reading groups', basis: 'stated', sourceQuote: 'organising reading groups' }] } });
  });
  await page.goto('/applicant'); await login(page);
  await page.locator('#custom-job-description').fill(jobText);
  await page.locator('#custom-company').fill('Riverview Library');
  await expect(page.locator('#extract-pasted')).toHaveCount(0);
  await page.getByRole('button', { name: 'Understand the role with AI' }).click();
  await expect(page.locator('#requirement-0')).toHaveValue('Organise reading groups');
  await nav(page, 'Self-assessment').click();
  await nav(page, 'Part 1 Interview').click();
  await page.locator('#transcript-editor').fill('Recruiter: PRIVATE INTERVIEWER WORDS\nApplicant: I organised a weekly reading group.');
  await nav(page, 'Full Resume').click();
  await page.getByRole('button', { name: 'Start from my applicant answers' }).click();
  await expect(page.locator('#share-text')).not.toHaveValue(/PRIVATE/);
  await page.getByRole('button', { name: 'Approve for company demo' }).click();
  await page.getByRole('navigation', { name: 'Demo accounts' }).getByRole('link', { name: 'Company' }).click(); await login(page, 'company');
  await nav(page, 'Review application').click();
  await expect(page.locator('#evaluation-panel')).toContainText('I organised a weekly reading group.');
  await expect(page.locator('#evaluation-panel')).not.toContainText('PRIVATE');
  await page.locator('#evaluation-panel').getByText('Organise reading groups', { exact: true }).click();
  await page.locator('#status-0').selectOption('Needs clarification');
  await page.locator('#reason-0').fill('Ask how attendance was tracked.');
  await page.getByRole('button', { name: 'Save assessment' }).click();
  await expect(page.locator('#saved-0')).toContainText('Saved');
});

test('provider errors retain pasted text and do not invent questions or requirements', async ({ page }) => {
  await page.route('**/api/understand-opportunity', route => route.fulfill({ status: 503, json: { error: 'Provider unavailable' } }));
  await page.route('**/api/generate-interview-questions', route => route.fulfill({ status: 502, json: { error: 'Provider unavailable' } }));
  await page.goto('/applicant'); await login(page);
  await page.locator('#custom-job-description').fill(jobText);
  await page.getByRole('button', { name: 'Understand the role with AI' }).click();
  await expect(page.locator('#opportunity-action-status')).toContainText('Provider unavailable');
  await expect(page.locator('#custom-job-description')).toHaveValue(jobText);
  await page.locator('#prepare-questions').click();
  await expect(page.locator('#question-generation-status')).toContainText('Provider unavailable');
  await expect(page.locator('#custom-questions')).toHaveValue('');
});

test('a URL import cannot overwrite edits made while AI is responding', async ({ page }) => {
  let release!: () => void;
  const pending = new Promise<void>(resolve => release = resolve);
  await page.route('**/api/extract-job-url', async route => { await pending; await route.fulfill({ json: { status: 'ok', company: 'Imported company', jobDescription: jobText } }); });
  await page.goto('/applicant'); await login(page);
  await page.locator('#job-url-input').fill('https://careers.example.org/library');
  await page.locator('#extract-job-url').click();
  await page.locator('#custom-job-description').fill('My current edits');
  release();
  await expect(page.locator('#job-import-status')).toContainText('Your edits have been kept');
  await expect(page.locator('#custom-job-description')).toHaveValue('My current edits');
});

test('missing AI configuration is explicit and the original UI fits a mobile screen', async ({ page }) => {
  await page.route('**/api/ai-status', route => route.fulfill({ json: { configured: false } }));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/applicant'); await login(page);
  await expect(page.locator('#ai-configuration')).toContainText('Live AI needs a provider key');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await nav(page, 'Self-assessment').click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});


test('photo landing is separate and the six-step flow with optional top Profile preserves details and an optional-followup resume', async ({ page }) => {
  await page.goto('/applicant');
  await expect(page.locator('.crb-frame')).toHaveClass(/is-landing/);
  await expect(page.locator('.crb-sidebar')).toBeHidden();
  await expect(page.locator('.crb-logo-mark')).toBeVisible();
  expect(await page.locator('.crb-top').evaluate(node => getComputedStyle(node).backgroundImage)).toContain('linear-gradient');
  expect(await page.locator('.crb-frame').evaluate(node => getComputedStyle(node).backgroundImage)).toContain('landing_page');
  await login(page);
  await expect(page.locator('#left-tabs button')).toHaveCount(6);
  const navigationColours = await page.locator('#left-tabs button').evaluateAll(buttons => buttons.map(button => getComputedStyle(button).backgroundColor));
  expect(new Set(navigationColours).size).toBeGreaterThan(1);
  expect(navigationColours.every(colour => colour !== 'rgba(0, 0, 0, 0)')).toBe(true);
  await page.locator('#custom-job-description').fill(jobText);
  await page.getByRole('button', { name: 'Continue →', exact: true }).click();
  await expect(page.locator('#quick-answer')).toBeVisible();
  await expect(page.locator('.crb-applicant-panel')).toBeHidden();
  await page.getByRole('button', { name: 'Profile', exact: true }).click();
  await expect(page.locator('.crb-applicant-panel')).toBeVisible();
  await page.locator('#applicant-info-name').fill('Sam');
  await page.locator('[data-label="Skills and tools"]').fill('Event coordination and attendance records');
  await page.getByRole('button', { name: 'Return to practice →', exact: true }).click();
  await expect(page.locator('#quick-answer')).toBeVisible();
  await page.getByRole('button', { name: 'Continue →', exact: true }).click();
  await expect(page.locator('#transcript-editor')).toBeVisible();
  await page.locator('#transcript-editor').fill('Applicant: I coordinated weekly reading groups and kept attendance records for twenty participants.');
  await page.getByRole('button', { name: 'Continue →', exact: true }).click();
  await expect(page.locator('#generate-resume')).toBeVisible();
  await page.getByRole('button', { name: 'Continue →', exact: true }).click();
  await expect(page.locator('#feedback-output')).toBeVisible();
  await page.getByRole('button', { name: 'Continue →', exact: true }).click();
  await expect(page.locator('#generate-resume')).toBeVisible();
  await expect(page.locator('#sharing-panel')).toBeVisible();
  await page.getByRole('button', { name: 'Profile', exact: true }).click();
  await expect(page.locator('#applicant-info-name')).toHaveValue('Sam');
  await nav(page, 'Self-assessment').click();
  await expect(page.locator('#transcript-editor')).toContainText('twenty participants');
});
