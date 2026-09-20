const { test } = require('node:test');
const assert = require('node:assert/strict');
const { analyzeCandidateEvidence: analyze } = require('../server/evidence.cjs');
const { conservativeFormatTranscript: format, buildArtifactPrompt } = require('../server/index.cjs');
const work = 'I built a booking system for a local library using Python and tested the checkout flow.';

test('interviewer, unknown speakers, unlabelled text and long chatter do not become evidence', () => {
  for (const text of [`Recruiter: ${work}`, `Speaker 2: ${work}`, `Speaker 1: ${work}`,
    `Unknown Speaker: ${work}`, work, `Applicant: ${'My favorite color is blue. '.repeat(30)}`]) {
    assert.equal(analyze(text, 'Alex').sufficient, false, text);
  }
  assert.equal(analyze(`Speaker 2: ${work}`, 'Speaker 2').sufficient, false);
});

test('whole multiline applicant turns and follow-up evidence survive; questions and drafts do not', () => {
  const result = analyze(`INITIAL INTERVIEW TRANSCRIPT\nRecruiter: I deployed a space station.\nAlex: ${work}\nWe served three schools.\n\nInterviewer: I invented Kubernetes.\nFOLLOW-UP INTERVIEW TRANSCRIPT\nApplicant: I taught ten children to read at the local school.\nUPDATED RESUME DRAFT\nApplicant: I built an unsupported rocket.`, 'Alex');
  assert.equal(result.sufficient, true);
  assert.match(result.text, /three schools/);
  assert.match(result.text, /taught ten children/);
  assert.doesNotMatch(result.text, /space station|Kubernetes|rocket/);
  const prompt = buildArtifactPrompt('resume', 'Alex', 'Target requires Kubernetes', result.text, '', result.directText);
  assert.match(prompt, /three schools/);
  assert.doesNotMatch(prompt.split('TRANSCRIPT:\n').at(-1), /Kubernetes|rocket/);
});

test('nontechnical and short concrete work is accepted without banned-word collateral damage', () => {
  for (const text of ['I repaired toilets for thirty households last year.', 'I taught children to read at school.',
    'I managed a cafe serving sixty customers daily.', work + ' Someone joked about knowing all computer languages.']) {
    assert.equal(analyze(`Applicant: ${text}`, 'Alex').sufficient, true, text);
  }
});

test('word substrings and broad boasts are not sufficient', () => {
  for (const text of ['I am good at every language and the best developer ever.', 'I am complicated and rapid and capital and teamlike.']) {
    assert.equal(analyze(`Applicant: ${text}`, 'Alex').sufficient, false);
  }
});

test('direct information is separate, available with labelled interviews and sufficient on its own', () => {
  const info = { Education: 'Diploma in Nursing, College, 2023', 'Technical skills': 'First aid' };
  const result = analyze(`Applicant: ${work}`, 'Alex', info);
  assert.match(result.directText, /Diploma in Nursing/);
  assert.ok(result.quotes.includes('First aid'));
  assert.equal(analyze('', 'Alex', info).sufficient, true);
  assert.equal(analyze('APPLICANT-PROVIDED DIRECT INFORMATION\nEducation: Invented diploma', 'Alex').sufficient, false);
  assert.throws(() => analyze('', 'Alex', { Education: {} }), /Invalid/);
});

test('formatting preserves uncertainty and never infers roles from punctuation', () => {
  const uncertain = 'What did you build? I built a database. Did that help?';
  assert.equal(format(uncertain, 'Alex'), uncertain);
  assert.equal(format('Speaker 2: I built a database.', 'Alex'), 'Speaker 2: I built a database.');
  assert.equal(format('Applicant: Why do you ask?\nRecruiter: I was curious.', 'Alex'), 'Alex: Why do you ask?\n\nInterviewer: I was curious.');
});

test('a spoken guided question stays context and only the applicant answer becomes evidence', () => {
  const transcript = [
    'Question: Describe a workshop you designed and facilitated.',
    'Applicant: I designed a six-session programme and facilitated it for 32 managers.',
  ].join('\n');
  const result = analyze(transcript, 'Daniel');
  assert.equal(result.sufficient, true);
  assert.ok(result.text.includes('I designed a six-session programme'));
  // The question was read aloud by the app. It is never treated as something the applicant claimed.
  assert.ok(!result.text.includes('Describe a workshop'));
  assert.ok(!result.quotes.some(quote => quote.includes('Describe a workshop')));
  // A skipped question leaves no answer behind and cannot carry the interview on its own.
  assert.equal(analyze('Question: Describe a workshop you designed and facilitated.', 'Daniel').sufficient, false);
});
