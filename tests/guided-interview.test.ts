import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseQuestions, stripSpeakerLabels } from '../src/guided-interview.ts';

test('numbered questions split into one spoken question each', () => {
  assert.deepEqual(parseQuestions('1. What did you lead?\n\n2. What changed?\n\n3. Who benefited?'),
    ['What did you lead?', 'What changed?', 'Who benefited?']);
  // A question wrapped over several lines stays one question.
  assert.deepEqual(parseQuestions('1. Tell us about a transformation\nyou personally led.\n\n2. What changed?'),
    ['Tell us about a transformation you personally led.', 'What changed?']);
  assert.deepEqual(parseQuestions('1) Bracket style?\n2) Second one?'), ['Bracket style?', 'Second one?']);
});

test('hand-written and empty question lists stay usable', () => {
  assert.deepEqual(parseQuestions('My own question?\n\nA second question?'), ['My own question?', 'A second question?']);
  for (const value of ['', '   ', '\n\n\n']) assert.deepEqual(parseQuestions(value), []);
  assert.deepEqual(parseQuestions(undefined as unknown as string), []);
});

test('a transcribed answer drops its speaker label so it is stored once', () => {
  assert.deepEqual(stripSpeakerLabels('Applicant: I rebuilt the intake form.'),
    { text: 'I rebuilt the intake form.', speakers: 1 });
  assert.deepEqual(stripSpeakerLabels('I rebuilt the intake form.'),
    { text: 'I rebuilt the intake form.', speakers: 0 });
});

test('a second speaker is reported so the applicant removes words that are not theirs', () => {
  const result = stripSpeakerLabels('Speaker 1: What did you do?\nSpeaker 2: I ran the pilot.');
  assert.equal(result.speakers, 2);
  assert.equal(result.text, 'What did you do?\nI ran the pilot.');
  // An unclear recording must not be silently attributed to the applicant.
  assert.equal(stripSpeakerLabels('Interviewer: Tell me more.\nApplicant: I led the review.').speakers, 2);
});
