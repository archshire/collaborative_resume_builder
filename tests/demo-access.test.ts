import { test } from 'node:test';
import assert from 'node:assert/strict';
import { acceptsDemoLogin, approveMaterial, applicantTurns } from '../src/demo-access.ts';
test('demo credentials are account-specific and never accept blank passwords', () => {
  assert.equal(acceptsDemoLogin('applicant', 'applicant', 'hireme'), true);
  assert.equal(acceptsDemoLogin('company', 'company', 'rightfit'), true);
  assert.equal(acceptsDemoLogin('applicant', 'company', 'rightfit'), false);
  assert.equal(acceptsDemoLogin('company', 'company', ''), false);
});
test('approval stores an explicit snapshot with no private fields or synthetic candidate', () => {
  const snapshot = approveMaterial('Ada', 'I taught a class.', 'Actual company', 'Actual job', 1);
  assert.deepEqual(Object.keys(snapshot).sort(), ['company','jobDescription','name','text','version']);
  assert.equal(snapshot.name, 'Ada'); assert.equal(snapshot.company, 'Actual company');
});
test('preview selects only explicit applicant turns and preserves multiline answers', () => {
  const text = applicantTurns('Recruiter: I built a rocket.\nAda: I taught a class.\nWe met every week.\nSpeaker 2: Unknown words.\nApplicant: I prepared lessons.', 'Ada');
  assert.equal(text, 'I taught a class.\nWe met every week.\nI prepared lessons.');
  assert.equal(applicantTurns('Speaker 2: I built it.', 'Speaker 2'), '');
});
