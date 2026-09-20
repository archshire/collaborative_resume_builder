const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const https = require('node:https');
const { EventEmitter } = require('node:events');
const { Readable } = require('node:stream');
process.env.GEMINI_API_KEY = 'test-gemini-key';
process.env.OPENAI_API_KEY = 'test-openai-key';
const { server } = require('../server/index.cjs');
let base;
before(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });

function post(route, body, headers = {}) {
  return fetch(base + route, { method: 'POST', headers: { 'Content-Type': 'application/json',
    'X-Resume-Client': '1', Origin: base, ...headers }, body: JSON.stringify(body) });
}
function mockProviders(t, outputs) {
  const requests = [];
  t.mock.method(https, 'request', (options, callback) => {
    const req = new EventEmitter();
    let data = '';
    req.write = chunk => { data += chunk; };
    req.end = () => queueMicrotask(() => {
      requests.push({ options, data });
      assert.ok(outputs.length, 'No unexpected provider calls');
      const res = Readable.from([Buffer.from(JSON.stringify(outputs.shift()))]);
      res.statusCode = 200;
      callback(res);
    });
    return req;
  });
  return requests;
}
const quote = 'I built a library booking system with Python and tested the checkout flow.';
const profile = () => ({ candidateProfileMarkdown: '# Profile', feedbackMarkdown: 'Clarify testing.',
  profileCards: Array.from({ length: 4 }, (_, i) => ({ label: `Skill ${i}`, evidenceStrength: 50, evidence: [quote], gap: 'Ask about scale.' })),
  followUpQuestions: Array(5).fill('How did you test it?') });

test('API rejects cross-origin calls before invoking a provider', async t => {
  const requests = mockProviders(t, []);
  assert.equal((await post('/api/transcribe', { data: 'YQ==' }, { Origin: 'https://attacker.test' })).status, 403);
  assert.equal((await post('/api/transcribe', { data: 'YQ==' }, { 'Content-Type': 'text/plain' })).status, 415);
  assert.equal(requests.length, 0);
});

test('health and local demo-session endpoints are available without provider calls', async () => {
  const health = await fetch(base + '/health');
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { status: 'ok' });
  const session = await fetch(base + '/api/demo-session');
  assert.equal(session.status, 200);
  assert.deepEqual(await session.json(), { required: false, authenticated: true });
});

test('invalid and oversized request bodies get client errors', async () => {
  assert.equal((await post('/api/generate-artifacts', null)).status, 400);
  assert.equal((await post('/api/generate-artifacts', { transcript: {} })).status, 400);
  assert.equal((await post('/api/generate-artifacts', { directInfo: { Education: {} } })).status, 400);
  assert.equal((await post('/api/generate-artifacts', { transcript: 'x'.repeat(530000) })).status, 413);
  assert.equal((await post('/api/generate-artifacts', { transcript: 'Applicant: text', mode: 'bogus' })).status, 400);
});

test('unknown speaker evidence is gated without calling providers', async t => {
  const requests = mockProviders(t, []);
  const response = await post('/api/generate-artifacts', { candidateName: 'Alex', transcript: `Speaker 2: ${quote}`, mode: 'resume' });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).provider, 'local-evidence-gate');
  assert.equal(requests.length, 0);
});

test('transcription fallback preserves unlabelled text without guessed attribution', async t => {
  mockProviders(t, [{}, { text: 'What did you build? I built a library system.' }]);
  const response = await post('/api/transcribe', { data: 'YQ==', applicantName: 'Alex' });
  const result = await response.json();
  assert.equal(result.provider, 'openai');
  assert.equal(result.transcript, 'What did you build? I built a library system.');
});

test('invalid AI output falls back; generation receives only applicant evidence plus separate direct info', async t => {
  const requests = mockProviders(t, [{ output_text: '{"resumeMarkdown":{}}' }, { output_text: '{"resumeMarkdown":"# Alex"}' }]);
  const response = await post('/api/generate-artifacts', { candidateName: 'Alex', mode: 'resume',
    transcript: `Recruiter: I built an unsupported rocket.\nApplicant: ${quote}`,
    directInfo: { Education: '42 Singapore, 2025' } });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { resumeMarkdown: '# Alex', provider: 'openai' });
  assert.equal(requests.length, 2);
  assert.doesNotMatch(requests[0].data, /unsupported rocket/);
  assert.match(requests[0].data, /42 Singapore/);
});

test('direct-info-only generation remains available', async t => {
  mockProviders(t, [{ output_text: '{"resumeMarkdown":"# Alex"}' }]);
  const response = await post('/api/generate-artifacts', { candidateName: 'Alex', mode: 'resume', directInfo: { Education: 'Diploma, 2025' } });
  assert.equal((await response.json()).provider, 'gemini');
});

test('profile source mismatch triggers fallback; all invalid providers produce an error', async t => {
  const bad = profile(); bad.profileCards[0].evidence = ['I flew a rocket.'];
  mockProviders(t, [{ output_text: JSON.stringify(bad) }, { output_text: JSON.stringify(profile()) },
    { output_text: JSON.stringify(bad) }, { output_text: JSON.stringify(bad) }]);
  const body = { candidateName: 'Alex', transcript: `Applicant: ${quote}`, mode: 'profile' };
  const response = await post('/api/generate-artifacts', body);
  assert.equal((await response.json()).provider, 'openai');
  const failure = await post('/api/generate-artifacts', body);
  assert.equal(failure.status, 502);
  assert.match((await failure.json()).details.join(' '), /not present/);
});

test('self-assessment excerpts fall back when unsupported and preserve the source', async t => {
  const answer = 'I contacted two replacement volunteers. We opened on time.';
  const good = { situationQuote: '', actionQuote: 'I contacted two replacement volunteers.', outcomeQuote: 'We opened on time.', followUpQuestion: '' };
  const requests = mockProviders(t, [{ output_text: JSON.stringify({ ...good, outcomeQuote: 'I saved a million dollars.' }) }, { output_text: JSON.stringify(good) }]);
  const response = await post('/api/reflect-answer', { answer, question: 'What did you do?' });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { excerpts: good, provider: 'openai' });
  assert.equal(requests.length, 2);
});

test('self-assessment endpoint rejects invalid input and returns a usable failure contract', async t => {
  const requests = mockProviders(t, [{ output_text: '{}' }, { output_text: '{}' }]);
  assert.equal((await post('/api/reflect-answer', { answer: {}, question: 'What?' })).status, 400);
  assert.equal((await post('/api/reflect-answer', { answer: 'x'.repeat(12001), question: 'What?' })).status, 400);
  assert.equal(requests.length, 0);
  const response = await post('/api/reflect-answer', { answer: 'A short answer.', question: 'What happened?' });
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /original answer/);
});

test('live opportunity analysis uses provided job text and falls back from fabricated source quotes', async t => {
  const jobDescription = 'Coordinate weekly sessions and keep accurate attendance records.';
  const good = { summary: 'Organise programmes and maintain records.', requirements: [{ text: 'Coordinate sessions', basis: 'stated', sourceQuote: 'Coordinate weekly sessions' }] };
  const bad = { ...good, requirements: [{ ...good.requirements[0], sourceQuote: 'An invented requirement.' }] };
  const calls = mockProviders(t, [{ output_text: JSON.stringify(bad) }, { output_text: JSON.stringify(good) }]);
  const response = await post('/api/understand-opportunity', { company: 'User supplied organisation', jobDescription });
  assert.equal(response.status, 200); assert.deepEqual(await response.json(), { ...good, provider: 'openai' });
  assert.match(calls[0].data, /User supplied organisation/); assert.match(calls[0].data, /Coordinate weekly sessions/);
});

test('opportunity failures never return sample role content', async t => {
  mockProviders(t, [{ output_text: '{}' }, { output_text: '{}' }]);
  assert.equal((await post('/api/understand-opportunity', { jobDescription: {} })).status, 400);
  const response = await post('/api/understand-opportunity', { jobDescription: 'A real supplied description.' });
  assert.equal(response.status, 503);
  const body = await response.json(); assert.equal(body.requirements, undefined); assert.equal(body.summary, undefined);
});


test('OpenAI job extraction requests strict string fields and still rejects malformed responses', async t => {
  const description = 'Coordinate weekly community reading groups, maintain attendance records, and communicate schedules to volunteers and participants.';
  const requests = mockProviders(t, [
    { output_text: JSON.stringify({ status: 'ok', company: 'Library', jobDescription: {} }) },
    { output_text: JSON.stringify({ status: 'ok', company: 'Library', jobDescription: description }) },
    { output_text: JSON.stringify({ status: 'ok', company: 'Library', jobDescription: {} }) },
    { output_text: JSON.stringify({ status: 'ok', company: 'Library', jobDescription: {} }) },
  ]);
  const body = { name: 'job.txt', text: ('Job responsibilities and requirements: ' + description).repeat(4), mimeType: 'text/plain' };
  const response = await post('/api/extract-job-document', body);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).jobDescription, description);
  const format = JSON.parse(requests[1].data).text.format;
  assert.equal(format.type, 'json_schema');
  assert.equal(format.strict, true);
  assert.equal(format.schema.properties.jobDescription.type, 'string');
  assert.equal((await post('/api/extract-job-document', body)).status, 502);
});

test('resume upload uses OpenAI-only strict fields and does not request response storage', async t => {
  const { fields } = require('../server/resume-import.cjs');
  const expected = {...Object.fromEntries(fields.map(key => [key,''])),Name:'Sam Lee',Email:'sam@example.com'};
  const requests=mockProviders(t,[{output_text:JSON.stringify(expected)}]);
  const response=await post('/api/import-resume',{name:'resume.txt',data:Buffer.from('Sam Lee\nEmail: sam@example.com').toString('base64')});
  assert.equal(response.status,200);assert.deepEqual((await response.json()).fields,expected);
  assert.equal(requests.length,1);assert.equal(requests[0].options.hostname,'api.openai.com');
  const payload=JSON.parse(requests[0].data);assert.equal(payload.store,false);assert.equal(payload.text.format.strict,true);
});
test('bad resume files are rejected without contacting providers', async t => {
  const requests=mockProviders(t,[]);
  assert.equal((await post('/api/import-resume',{name:'fake.pdf',data:'YQ=='})).status,400);
  assert.equal(requests.length,0);
});

test('a pasted key with surrounding whitespace cannot break the Authorization header', () => {
  const { normalizeProviderEnv } = require('../server/index.cjs');
  // A dashboard-injected value keeps the newline the user pasted; Node rejects it as a header.
  const env = normalizeProviderEnv({
    OPENAI_API_KEY: 'sk-test-key\n',
    GEMINI_API_KEY: '  gem-key  ',
    OPENAI_SPEECH_MODEL: 'gpt-4o-mini-tts\r\n',
    DEMO_ACCESS_PASSWORD: ' kept as typed ',
  });
  assert.equal(env.OPENAI_API_KEY, 'sk-test-key');
  assert.equal(env.GEMINI_API_KEY, 'gem-key');
  assert.equal(env.OPENAI_SPEECH_MODEL, 'gpt-4o-mini-tts');
  for (const value of Object.values(env)) assert.doesNotThrow(() => new Headers({ authorization: `Bearer ${value}` }));
  // A password is a user secret, not a credential header: it is left exactly as configured.
  assert.equal(env.DEMO_ACCESS_PASSWORD, ' kept as typed ');
  assert.deepEqual(normalizeProviderEnv({}), {});
});
