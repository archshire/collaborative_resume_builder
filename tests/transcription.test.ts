import { test } from 'node:test';
import assert from 'node:assert/strict';
import { transcribeBatch } from '../src/transcription.ts';

for (const mode of ['initial', 'followup']) {
  test(`${mode}: a failed second chunk preserves the first and retry does not duplicate it`, async () => {
    const files = [{ transcribed: false }, { transcribed: false }, { transcribed: false }];
    let transcript = 'Manually entered evidence';
    const commit = (_file: unknown, text: string) => { transcript += `\n${text}`; };
    await assert.rejects(transcribeBatch(files, async (_file, index) => {
      if (index === 1) throw new Error('provider unavailable');
      return `chunk ${index}`;
    }, commit), /provider unavailable/);
    assert.equal(transcript, 'Manually entered evidence\nchunk 0');
    assert.deepEqual(files.map(file => file.transcribed), [true, false, false]);
    const calls: number[] = [];
    await transcribeBatch(files, async (_file, index) => { calls.push(index); return `chunk ${index}`; }, commit);
    assert.deepEqual(calls, [1, 2]);
    assert.equal(transcript, 'Manually entered evidence\nchunk 0\nchunk 1\nchunk 2');
    assert.ok(files.every(file => file.transcribed));
  });
}

test('empty, missing and non-string success responses remain retryable', async () => {
  for (const value of ['', '  ', null, undefined, {}, ['text'], 42]) {
    const file = { transcribed: false };
    await assert.rejects(transcribeBatch([file], async () => value, () => assert.fail('must not commit')), /invalid transcript/);
    assert.equal(file.transcribed, false);
  }
});

test('a failed editor commit does not mark the file complete', async () => {
  const file = { transcribed: false };
  await assert.rejects(transcribeBatch([file], async () => 'saved text', () => { throw new Error('editor failed'); }));
  assert.equal(file.transcribed, false);
});
