const { test } = require('node:test');
const assert = require('node:assert/strict');
const { speechInput, MAX_SPEECH_CHARACTERS, DEFAULT_VOICE } = require('../server/speech.cjs');

test('speech input accepts one question and defaults the voice', () => {
  assert.deepEqual(speechInput({ text: '  Tell me about a project you led.  ' }),
    { text: 'Tell me about a project you led.', voice: DEFAULT_VOICE });
  assert.equal(speechInput({ text: 'Question?', voice: 'nova' }).voice, 'nova');
  assert.equal(speechInput({ text: 'Question?', voice: '' }).voice, DEFAULT_VOICE);
  assert.equal(speechInput({ text: 'x'.repeat(MAX_SPEECH_CHARACTERS) }).text.length, MAX_SPEECH_CHARACTERS);
});

test('speech input rejects unusable text and unknown voices before any paid provider call', () => {
  for (const body of [null, undefined, [], {}, { text: '' }, { text: '   ' }, { text: 42 },
    { text: 'x'.repeat(MAX_SPEECH_CHARACTERS + 1) },
    { text: 'Question?', voice: 'unknown-voice' },
    { text: 'Question?', voice: 'nova; rm -rf /' },
    { text: 'Question?', voice: 7 }]) {
    assert.throws(() => speechInput(body), Error, `expected rejection for ${JSON.stringify(body)}`);
  }
});
