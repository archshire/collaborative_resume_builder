import { test, expect, type Page } from '@playwright/test';
test.use({ launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] } });

const nav = (page: Page, name: string) => page.getByRole('navigation', { name: 'Workspace navigation' }).getByRole('button', { name });
// A short silent MP3 frame stands in for the provider's audio.
const silentMp3 = Buffer.from('//uQZAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAACcQCA', 'base64').toString('base64');

async function openGuided(page: Page) {
  await page.goto('/applicant');
  await page.getByRole('button', { name: 'Try the completed applicant demo' }).click();
  await nav(page, 'Part 1 Interview').click();
}

test('questions are spoken one at a time and only confirmed answers reach the transcript', async ({ page }) => {
  const spoken: string[] = [];
  await page.route('**/api/speak-question', async (route) => {
    spoken.push(JSON.parse(route.request().postData() || '{}').text);
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ audio: silentMp3, mimeType: 'audio/mpeg', provider: 'openai' }) });
  });
  await openGuided(page);
  await page.getByRole('button', { name: 'Start guided interview' }).click();

  await expect(page.locator('#guided-progress')).toHaveText('Question 1 of 8');
  await expect(page.locator('#guided-question')).toContainText('What do you think SUTD needs this person to accomplish');
  await expect.poll(() => spoken.length).toBe(1);
  expect(spoken[0]).toContain('What do you think SUTD needs');

  // An empty answer is never saved on the applicant's behalf.
  await page.getByRole('button', { name: 'Save answer and continue' }).click();
  await expect(page.locator('#guided-status')).toContainText('Record or type an answer first');
  await expect(page.locator('#guided-progress')).toHaveText('Question 1 of 8');

  await page.locator('#guided-answer').fill('I would connect live industry problems to student project work in the first year.');
  await page.getByRole('button', { name: 'Save answer and continue' }).click();
  await expect(page.locator('#guided-progress')).toHaveText('Question 2 of 8');
  await expect(page.locator('#guided-answer')).toHaveValue('');
  await expect.poll(() => spoken.length).toBe(2);

  // The question is stored as context beside the applicant's own words.
  await expect(page.locator('#transcript')).toHaveValue(/Question: What do you think SUTD needs/);
  await expect(page.locator('#transcript')).toHaveValue(/Applicant: I would connect live industry problems/);

  // A skipped question adds no guided exchange of its own to the transcript.
  await page.getByRole('button', { name: 'Skip this question' }).click();
  await expect(page.locator('#guided-progress')).toHaveText('Question 3 of 8');
  await expect(page.locator('#transcript')).not.toHaveValue(/Question: Tell us about an AI-enabled or digital transformation/);

  await page.getByRole('button', { name: 'End guided interview' }).click();
  await expect(page.locator('#guided-intro-status')).toContainText('You answered 1 of 8 questions');
});

test('a spoken answer is transcribed into an editable box before it is saved', async ({ page }) => {
  await page.route('**/api/speak-question', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'no key', fallback: 'browser' }) }));
  await page.route('**/api/transcribe', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ transcript: 'Applicant: I ran a six session programme for thirty two managers.' }) }));
  await openGuided(page);
  await page.getByRole('button', { name: 'Start guided interview' }).click();
  await expect(page.locator('#guided-question')).not.toBeEmpty();

  await page.getByRole('button', { name: 'Record answer' }).click();
  await expect(page.locator('#guided-status')).toContainText('Recording');
  await page.getByRole('button', { name: 'Stop and transcribe' }).click();

  // The applicant reviews and may correct the transcription; the speaker label is not duplicated.
  await expect(page.locator('#guided-answer')).toHaveValue('I ran a six session programme for thirty two managers.');
  await expect(page.locator('#guided-status')).toContainText('correct anything before you save');
  await page.locator('#guided-answer').fill('I ran a six-session programme for 32 managers.');
  await page.getByRole('button', { name: 'Save answer and continue' }).click();
  await expect(page.locator('#transcript')).toHaveValue(/Applicant: I ran a six-session programme for 32 managers\./);
});

test('a failed transcription keeps the question answerable by typing', async ({ page }) => {
  await page.route('**/api/speak-question', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'no key' }) }));
  await page.route('**/api/transcribe', (route) => route.fulfill({ status: 502, contentType: 'application/json', body: JSON.stringify({ error: 'Automated transcription failed for all configured providers.' }) }));
  await openGuided(page);
  await page.getByRole('button', { name: 'Start guided interview' }).click();
  // Silent speech must still release the controls, or the question can never be replayed.
  await expect(page.getByRole('button', { name: 'Read again' })).toBeEnabled();
  await page.getByRole('button', { name: 'Record answer' }).click();
  await page.getByRole('button', { name: 'Stop and transcribe' }).click();
  await expect(page.locator('#guided-status')).toContainText('You can type this answer instead');
  await expect(page.locator('#guided-answer')).toBeEditable();
  await expect(page.locator('#guided-progress')).toHaveText('Question 1 of 8');
});

test('the guided interview asks for questions before it starts', async ({ page }) => {
  await page.goto('/applicant');
  await page.getByLabel('Login name', { exact: true }).fill('applicant');
  await page.getByLabel('Password', { exact: true }).fill('hireme');
  await page.getByRole('button', { name: 'Enter applicant workspace' }).click();
  await nav(page, 'Part 1 Interview').click();
  await page.getByRole('button', { name: 'Start guided interview' }).click();
  await expect(page.locator('#guided-intro-status')).toContainText('Generate or paste interview questions');
  await expect(page.locator('#guided-live')).toBeHidden();
});
