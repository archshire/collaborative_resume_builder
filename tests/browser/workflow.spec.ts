import { test, expect } from '@playwright/test';

for (const prefix of ['', 'followup-']) {
  test(`${prefix || 'initial-'}batch saves partial results, preserves edits and retries only failures`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    const calls: string[] = [];
    let secondAttempts = 0;
    await page.route('**/api/transcribe', async route => {
      expect(route.request().headers()['x-resume-client']).toBe('1');
      const { name } = route.request().postDataJSON();
      calls.push(name);
      if (name === 'second.wav' && secondAttempts++ === 0) {
        await route.fulfill({ status: 502, json: { error: 'Simulated provider failure' } });
      } else {
        await route.fulfill({ json: { transcript: `Applicant: I built the ${name} booking application for a library.` } });
      }
    });
    await page.goto('/interview');
    const editor = page.locator(`#${prefix}transcript-editor`);
    await editor.fill('Applicant: I taught children to read at school.');
    await page.locator(`#${prefix}file-input`).setInputFiles([
      { name: 'first.wav', mimeType: 'audio/wav', buffer: Buffer.from('audio fixture') },
      { name: 'second.wav', mimeType: 'audio/wav', buffer: Buffer.from('audio fixture') },
    ]);
    const button = page.locator(`#${prefix}transcribe-files`);
    await button.click();
    await expect(page.locator(`#${prefix}transcription-helper`)).toContainText('Simulated provider failure');
    await expect(editor).toContainText('first.wav booking');
    await expect(editor).toContainText('I taught children');
    await expect(button).toBeEnabled();
    await editor.fill((await editor.innerText()) + '\nApplicant: I also managed a cafe serving sixty customers daily.');
    await button.click();
    await expect(button).toBeDisabled();
    await expect(editor).toContainText('second.wav booking');
    await expect(editor).toContainText('managed a cafe');
    expect(calls).toEqual(['first.wav', 'second.wav', 'second.wav']);
    expect((await editor.innerText()).match(/first.wav booking/g)).toHaveLength(1);
    expect(errors).toEqual([]);
  });
}

test('Part 1 to Part 2 retains direct information and keeps generated drafts outside transcript evidence', async ({ page }) => {
  const requests: any[] = [];
  await page.route('**/api/generate-artifacts', async route => {
    expect(route.request().headers()['x-resume-client']).toBe('1');
    const body = route.request().postDataJSON();
    requests.push(body);
    await route.fulfill({ json: body.mode === 'resume' ? { resumeMarkdown: '# Alex\n\nDraft-only sentinel.' } : {
      candidateProfileMarkdown: '# Candidate Profile: Alex\n\nLibrary software experience.',
      profileCards: [{ label: 'Projects', evidenceStrength: 50, evidence: ['Built library software.'], gap: 'Clarify scale.' }],
      feedbackMarkdown: 'Ask about testing.', followUpQuestions: ['How did you test it?'],
    } });
  });
  await page.goto('/interview');
  await page.locator('#recruiter-name').fill('Sam');
  await page.locator('#applicant-name').fill('Alex');
  await page.locator('[data-label="Education"]').fill('42 Singapore, 2025');
  await page.locator('#transcript-editor').fill('Applicant: I built a library booking system using Python and tested the checkout flow.');
  await page.locator('#generate-resume').click();
  await expect(page.locator('#resume-output')).toContainText('Draft-only sentinel');
  await page.locator('#generate-profile').click();
  await expect(page.locator('#profile-output')).toContainText('Projects');
  await page.locator('#followup-ready').click();
  await expect(page.locator('#followup-ready')).toHaveClass(/is-ready/);
  await page.locator('#followup-transcript-editor').fill('Applicant: I wrote twenty automated tests and deployed the library application for three schools.');
  await page.locator('#regenerate-resume').click();
  await expect(page.locator('#updated-resume-output')).toContainText('Draft-only sentinel');
  await page.locator('#regenerate-profile').click();
  await expect(page.locator('#updated-profile-output')).toContainText('Projects');
  await expect(page.locator('#save-updated-resume-pdf')).toBeEnabled();
  expect(requests).toHaveLength(4);
  for (const body of requests) {
    expect(body.directInfo.Education).toBe('42 Singapore, 2025');
    expect(body.transcript).not.toContain('Draft-only sentinel');
  }
  expect(requests[3].transcript).toContain('twenty automated tests');
  expect(requests[3].existingResume).toContain('Draft-only sentinel');
});

test('direct-information-only generation reaches the same-origin backend and reports provider errors', async ({ page }) => {
  await page.route('**/api/generate-artifacts', route => route.fulfill({
    status: 502,
    json: { error: 'OpenAI provider unavailable for this test.' },
  }));
  await page.goto('/interview');
  await page.locator('[data-label="Education"]').fill('Diploma in Nursing, 2025');
  await expect(page.locator('#generate-resume')).toBeEnabled();
  const response = page.waitForResponse('**/api/generate-artifacts');
  await page.locator('#generate-resume').click();
  expect((await response).status()).toBe(502);
  await expect(page.locator('#resume-output')).toContainText('OpenAI provider unavailable for this test');
});
