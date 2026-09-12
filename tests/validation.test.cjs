const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateArtifacts: artifacts, validateInterviewQuestions: questions, validateJobExtraction: job } = require('../server/validation.cjs');
const quote = 'I built a booking system for the library.';
const valid = () => ({ candidateProfileMarkdown: '# Profile', feedbackMarkdown: 'Ask about testing.',
  profileCards: Array.from({ length: 4 }, (_, i) => ({ label: `Skill ${i}`, evidenceStrength: 40, evidence: [quote], gap: 'Testing' })),
  followUpQuestions: Array(5).fill('How did you test it?') });

test('valid resume/profile payloads are projected onto their schema', () => {
  assert.deepEqual(artifacts({ resumeMarkdown: '# Alex', profileCards: [null] }, 'test', 'resume'), { resumeMarkdown: '# Alex' });
  assert.deepEqual(artifacts(valid(), 'test', 'profile', [quote]), valid());
});

test('malformed nested payloads, scores, strings and cardinalities are rejected', () => {
  for (const value of [null, [], 4, 'resume', {}, { resumeMarkdown: 12 }, { resumeMarkdown: '  ' }, { resumeLatex: '# Alex' }]) {
    assert.throws(() => artifacts(value, 'test', 'resume'));
  }
  for (const mutate of [p => p.profileCards = {}, p => p.profileCards = [null], p => p.profileCards[0] = null,
    p => p.profileCards[0].evidence = 'text', p => p.profileCards[0].evidence = [null],
    ...[NaN, Infinity, -1, 101, '40'].map(value => p => p.profileCards[0].evidenceStrength = value),
    p => p.profileCards[0].label = {}, p => p.profileCards[0].gap = [], p => p.profileCards[0].evidence = [],
    p => p.followUpQuestions = ['one'], p => p.followUpQuestions[0] = {}, p => p.feedbackMarkdown = {},
    p => p.candidateProfileMarkdown = 'x'.repeat(30001)]) {
    const payload = valid(); mutate(payload);
    assert.throws(() => artifacts(payload, 'test', 'profile', [quote]));
  }
});

test('evidence must quote a complete applicant sentence, preserving negations', () => {
  assert.throws(() => artifacts(valid(), 'test', 'profile', ['The recruiter built the booking system.']), /not present/);
  const payload = valid(); payload.profileCards[0].evidence = ['used Python'];
  assert.throws(() => artifacts(payload, 'test', 'profile', [quote, 'I never used Python.']), /not present/);
  payload.profileCards[0].evidence = []; payload.profileCards[0].evidenceStrength = 0;
  assert.doesNotThrow(() => artifacts(payload, 'test', 'profile', [quote]));
});

test('interview questions and job extraction reject type coercion and invalid bounds', () => {
  assert.equal(questions({ questions: Array(8).fill('What did you build?') }, 'test').length, 8);
  for (const values of [Array(8).fill({}), Array(8).fill('word '.repeat(19)), ['one'], Array(8).fill('')]) {
    assert.throws(() => questions({ questions: values }, 'test'));
  }
  assert.deepEqual(job({ status: 'not_job' }, 'test'), { status: 'not_job' });
  assert.throws(() => job({ status: 'ok', company: {}, jobDescription: 'x'.repeat(100) }, 'test'));
  assert.throws(() => job({ status: 'ok', company: 'Company', jobDescription: ['x'.repeat(100)] }, 'test'));
  assert.throws(() => job({ status: 'ok', company: 'Company', jobDescription: 'short' }, 'test'));
});
