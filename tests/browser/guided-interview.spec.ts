import { test, expect, type Page } from '@playwright/test';
test.use({ launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] } });

const nav = (page: Page, name: string) => page.getByRole('navigation', { name: 'Workspace navigation' }).getByRole('button', { name });
const silentMp3 = Buffer.from('//uQZAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAACcQCA', 'base64').toString('base64');

/** Records the order of spoken questions, and whether the microphone was ever opened while speaking. */
async function stubVoice(page: Page, spoken: string[], opened: { while: string[] }) {
  let speaking = false;
  await page.exposeFunction('__crbMicOpened', () => { if (speaking) opened.while.push(spoken[spoken.length - 1]); });
  await page.addInitScript(() => {
    const scope = window as unknown as { __crbMicOpened: () => void; __tracks: MediaStreamTrack[] };
    scope.__tracks = [];
    const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async (...args) => {
      scope.__crbMicOpened();
      const stream = await original(...args);
      scope.__tracks.push(...stream.getTracks());
      return stream;
    };
  });
  await page.route('**/api/speak-question', async route => {
    spoken.push(JSON.parse(route.request().postData() || '{}').text);
    speaking = true;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ audio: silentMp3, mimeType: 'audio/mpeg' }) });
    setTimeout(() => { speaking = false; }, 50);
  });
}

async function openGuided(page: Page) {
  await page.goto('/applicant');
  await page.getByRole('button', { name: 'Try the completed applicant demo' }).click();
  await nav(page, 'Part 1 Interview').click();
}

test('the conversation advances on its own without the applicant pressing next', async ({ page }) => {
  const spoken: string[] = [];
  const opened = { while: [] as string[] };
  await stubVoice(page, spoken, opened);
  await page.route('**/api/reflect-answer', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ excerpts: { situationQuote: '', actionQuote: '', outcomeQuote: '', followUpQuestion: '' } }),
  }));
  await openGuided(page);
  await page.getByRole('button', { name: 'Start conversation' }).click();

  await expect(page.locator('#guided-progress')).toHaveText('Question 1 of 8');
  await expect(page.locator('#guided-question')).toContainText('What do you think SUTD needs');

  // Answer by typing; the loop must continue by itself from there.
  await page.getByRole('button', { name: 'Type this answer' }).click();
  await page.locator('#guided-answer').fill('I would connect live industry problems to student project work.');
  await page.getByRole('button', { name: 'Send and continue' }).click();

  // No button press moved this on: the next question is asked automatically.
  await expect(page.locator('#guided-progress')).toHaveText('Question 2 of 8', { timeout: 15000 });
  await expect(page.locator('#guided-question')).toContainText('Tell us about an AI-enabled');
  await expect.poll(() => spoken.length, { timeout: 15000 }).toBeGreaterThanOrEqual(2);

  // The exchange is in the running log and in the editable transcript.
  await expect(page.locator('#guided-log')).toContainText('What do you think SUTD needs');
  await expect(page.locator('#guided-log')).toContainText('I would connect live industry problems');
  await expect(page.locator('#transcript')).toHaveValue(/Question: What do you think SUTD needs/);
  await expect(page.locator('#transcript')).toHaveValue(/Applicant: I would connect live industry problems/);

  // The microphone must never be open while CRB is speaking, or the question is transcribed as the answer.
  expect(opened.while).toEqual([]);
});

test('a grounded follow-up is asked before moving to the next question', async ({ page }) => {
  const spoken: string[] = [];
  await stubVoice(page, spoken, { while: [] });
  await page.route('**/api/reflect-answer', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ excerpts: { situationQuote: '', actionQuote: '', outcomeQuote: '', followUpQuestion: 'What changed as a result?' } }),
  }));
  await openGuided(page);
  await page.getByRole('button', { name: 'Start conversation' }).click();
  await page.getByRole('button', { name: 'Type this answer' }).click();
  await page.locator('#guided-answer').fill('I ran a six-session programme for 32 managers.');
  await page.getByRole('button', { name: 'Send and continue' }).click();

  await expect(page.locator('#guided-question')).toHaveText('What changed as a result?', { timeout: 15000 });
  await expect(page.locator('#guided-phase')).toContainText('Following up');
  // A follow-up stays on the same question number rather than consuming one.
  await expect(page.locator('#guided-progress')).toHaveText('Question 1 of 8');
  expect(spoken).toContain('What changed as a result?');
});

test('a skipped question adds nothing and moves on', async ({ page }) => {
  await stubVoice(page, [], { while: [] });
  await openGuided(page);
  await page.getByRole('button', { name: 'Start conversation' }).click();
  await expect(page.locator('#guided-progress')).toHaveText('Question 1 of 8');
  await page.getByRole('button', { name: 'Skip question' }).click();
  await expect(page.locator('#guided-progress')).toHaveText('Question 2 of 8', { timeout: 15000 });
  await expect(page.locator('#transcript')).not.toHaveValue(/Question: What do you think SUTD needs/);
});

test('ending the conversation stops speech and releases the microphone', async ({ page }) => {
  await stubVoice(page, [], { while: [] });
  await openGuided(page);
  await page.getByRole('button', { name: 'Start conversation' }).click();
  await expect(page.locator('#guided-live')).toBeVisible();
  await page.getByRole('button', { name: 'End conversation' }).click();
  await expect(page.locator('#guided-live')).toBeHidden();
  await expect(page.locator('#guided-intro-status')).toContainText('You answered 0 of 8 questions');
  // Every microphone track opened during the conversation must actually be stopped.
  const open = await page.evaluate(() => {
    const tracks = (window as unknown as { __tracks?: MediaStreamTrack[] }).__tracks ?? [];
    return { total: tracks.length, live: tracks.filter(track => track.readyState === 'live').length };
  });
  expect(open.live, `${open.live} of ${open.total} microphone tracks were left open`).toBe(0);
});

test('the conversation asks for questions before it starts', async ({ page }) => {
  await page.goto('/applicant');
  await page.getByLabel('Login name', { exact: true }).fill('applicant');
  await page.getByLabel('Password', { exact: true }).fill('hireme');
  await page.getByRole('button', { name: 'Enter applicant workspace' }).click();
  await nav(page, 'Part 1 Interview').click();
  await page.getByRole('button', { name: 'Start conversation' }).click();
  await expect(page.locator('#guided-intro-status')).toContainText('Generate or paste interview questions');
  await expect(page.locator('#guided-live')).toBeHidden();
});

test('the orb reflects each phase and stays decorative for screen readers', async ({ page }) => {
  const spoken: string[] = [];
  await stubVoice(page, spoken, { while: [] });
  await page.route('**/api/reflect-answer', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ excerpts: { situationQuote: '', actionQuote: '', outcomeQuote: '', followUpQuestion: '' } }),
  }));
  await openGuided(page);
  const orb = page.locator('#guided-orb');
  await page.getByRole('button', { name: 'Start conversation' }).click();
  // Speaking, then listening once playback has finished.
  await expect(orb).toHaveAttribute('data-phase', 'listening', { timeout: 15000 });
  await expect(page.locator('#guided-phase')).toContainText('Listening');
  // Decorative: the phase is conveyed as text, so the orb is hidden from assistive technology.
  await expect(orb).toHaveAttribute('aria-hidden', 'true');

  await page.getByRole('button', { name: 'Type this answer' }).click();
  await page.locator('#guided-answer').fill('I ran a six-session programme for 32 managers.');
  await page.getByRole('button', { name: 'Send and continue' }).click();
  await expect(orb).toHaveAttribute('data-phase', 'speaking', { timeout: 15000 });
  // Leaving the listening phase resets the level so the orb does not freeze mid-pulse.
  await expect.poll(async () => orb.evaluate(node => node.style.getPropertyValue('--orb-scale')))
    .toBe('1');
});
