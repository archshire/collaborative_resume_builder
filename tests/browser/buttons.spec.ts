import { test, expect, type Page } from '@playwright/test';
test.use({launchOptions:{args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']}});
const example = 'I organised weekly reading groups for twenty neighbours and kept accurate attendance records.';
const job = 'The library needs a coordinator to organise reading groups, communicate with volunteers and maintain attendance records. Requirements include organisation and communication skills. This is a fictional posting used in automated regression tests.';
const nav = (page: Page, id: string) => page.locator(`[data-tab="${id}"]`).click();
async function login(page: Page) {
  await page.goto('/applicant');
  await page.locator('#login-name').fill('applicant'); await page.locator('#login-password').fill('hireme');
  await page.locator('#login-form button').click();
}
async function download(page: Page, id: string) {
  const promise = page.waitForEvent('download'); await page.locator(id).click();
  const file = await promise; expect(await file.failure()).toBeNull();
  expect(file.suggestedFilename()).not.toBe('');
}
async function printPreview(page: Page, id: string) {
  const promise = page.waitForEvent('popup'); await page.locator(id).click();
  const popup = await promise; await expect(popup.locator('.resume-paper')).toContainText('Sam'); await popup.close();
}
test('document import, answer organisation, generation, exports, follow-up, sharing and logout controls', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await context.addInitScript(() => { window.print = () => {}; });
  const errors: string[] = [];page.on('pageerror', e => errors.push(e.message));
  await page.route('**/api/extract-job-document', r => r.fulfill({json:{status:'ok',company:'Library',jobDescription:job}}));
  await page.route('**/api/reflect-answer', r => r.fulfill({json:{excerpts:{situationQuote:'',actionQuote:example,outcomeQuote:'',followUpQuestion:'How often?'}}}));
  await page.route('**/api/generate-artifacts', r => {
    const body=r.request().postDataJSON();
    return r.fulfill({json:body.mode==='resume'?{resumeMarkdown:'# Sam\n\n'+example}:{candidateProfileMarkdown:'# Candidate Profile: Sam\n\n'+example,profileCards:[],feedbackMarkdown:'Clarify frequency.',followUpQuestions:['How often did the groups meet?']}});
  });
  await login(page);
  await page.locator('#job-document-input').setInputFiles({name:'posting.txt',mimeType:'text/plain',buffer:Buffer.from(job)});
  await page.locator('#extract-job-url').click();await expect(page.locator('#custom-job-description')).toHaveValue(job);
  await nav(page,'applicant');await page.locator('#applicant-info-name').fill('Sam');
  await nav(page,'interview');await page.locator('#together').check();await expect(page.locator('#recruiter-name')).toBeVisible();await page.locator('#together').uncheck();
  await nav(page,'assessment');await page.locator('#quick-answer').fill(example);await page.locator('#organise-answer').click();await expect(page.locator('#answer-excerpts')).toContainText(example);
  await page.locator('#add-answer').click();await expect(page.locator('#quick-answer')).toHaveValue('');await nav(page,'interview');await download(page,'#download-transcript');
  await page.locator('#applicant-document-input').setInputFiles({name:'extra.txt',mimeType:'text/plain',buffer:Buffer.from('I also volunteered at a food bank.')});
  await expect(page.locator('#additional-info')).toHaveValue(/food bank/);
  await nav(page,'outputs');await page.locator('#generate-resume').click();await expect(page.locator('#resume-output')).toContainText(example);
  await page.locator('#copy-resume').click();await expect.poll(()=>page.evaluate(()=>navigator.clipboard.readText())).toContain('Sam');
  await printPreview(page,'#download-resume');
  await page.locator('#generate-candidate-profile').click();await expect(page.locator('#candidate-profile-output')).toContainText('Sam');await download(page,'#download-candidate-profile');
  await nav(page,'followup');await download(page,'#download-feedback');
  await page.locator('#followup-transcript-editor').fill('Applicant: I organised one session every week and coordinated four volunteers for six months.');
  await download(page,'#download-followup-transcript');
  await nav(page,'sharing');await page.locator('#regenerate-resume').click();await expect(page.locator('#updated-resume-output')).toContainText('Sam');
  await page.locator('#copy-updated-resume').click();await expect.poll(()=>page.evaluate(()=>navigator.clipboard.readText())).toContain('Sam');
  await printPreview(page,'#save-updated-resume-pdf');
  await page.locator('#regenerate-candidate-profile').click();await expect(page.locator('#updated-candidate-profile-output')).toContainText('Sam');await download(page,'#download-updated-candidate-profile');
  await page.locator('#copy-applicant-turns').click();await page.locator('#approve-material').click();await expect(page.locator('#sharing-status')).toContainText('can now see');
  await page.locator('#withdraw-material').click();await expect(page.locator('#sharing-status')).toContainText('Withdrawn');
  await page.locator('#logout').click();await expect(page.locator('#login-panel')).toBeVisible();
  expect(errors).toEqual([]);
});

test.describe('microphone and recording controls', () => {
  test('check mic, record, pause/resume, stop, download, transcribe and remove uploads in both interviews', async ({page}) => {
    await page.route('**/api/transcribe', r=>r.fulfill({json:{transcript:'Applicant: '+example}}));
    await login(page);await nav(page,'interview');
    await page.locator('#test-mic').click();await expect(page.locator('#test-mic')).toContainText('Stop');await page.locator('#test-mic').click();
    for (const prefix of ['', 'followup-']) {
      if(prefix) await nav(page,'followup');
      await page.locator(`#${prefix}start-recording`).click();await expect(page.locator(`#${prefix}pause-recording`)).toBeEnabled();
      await page.locator(`#${prefix}pause-recording`).click();await expect(page.locator(`#${prefix}pause-recording`)).toHaveAttribute('aria-label',/Resume/);
      await page.locator(`#${prefix}pause-recording`).click();
      await page.locator(`#${prefix}stop-recording`).click();
      const recording=page.locator(`#${prefix}recording-list`);
      await expect(recording.locator('.transcribe-recording')).toBeVisible();
      const promise=page.waitForEvent('download');await recording.getByRole('link').click();await promise;
      await recording.locator('.transcribe-recording').click();await expect(recording.locator('.transcribe-recording')).toBeDisabled();
      await expect(page.locator(`#${prefix}transcript-editor`)).toContainText(example);
      await page.locator(`#${prefix}file-input`).setInputFiles({name:'test.wav',mimeType:'audio/wav',buffer:Buffer.from('fixture')});
      await page.getByRole('button',{name:'Remove test.wav',exact:true}).click();await expect(page.locator(`#${prefix}transcribe-files`)).toBeDisabled();
      await page.locator(`#${prefix}file-input`).setInputFiles({name:'test.wav',mimeType:'audio/wav',buffer:Buffer.from('fixture')});
      await page.locator(`#${prefix}transcribe-files`).click();await expect(page.locator(`#${prefix}transcribe-files`)).toBeDisabled();
    }
  });
});

test('new session clears the demo after the user accepts the unsaved-work prompt', async ({page})=>{
  await login(page);await nav(page,'assessment');await page.locator('#quick-answer').fill(example);
  await nav(page,'interview');page.on('dialog',d=>d.accept());await page.locator('#new-session-top').click();await expect(page.locator('#login-panel')).toBeVisible();
  await page.locator('#login-name').fill('applicant');await page.locator('#login-password').fill('hireme');await page.locator('#login-form button').click();
  await nav(page,'assessment');await expect(page.locator('#quick-answer')).toHaveValue('');
});
