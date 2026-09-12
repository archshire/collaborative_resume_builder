const { test } = require('node:test');
const assert = require('node:assert/strict');
const { opportunityFormat, reflectionFormat, questionsFormat, artifactFormat } = require('../server/response-formats.cjs');
const { validateOpportunity } = require('../server/opportunity.cjs');
const { validateReflection } = require('../server/reflection.cjs');
test('role and answer schemas constrain excerpts to actual source sentences', () => {
  const source = 'I organised weekly reading groups. Attendance increased to twenty people.';
  const role = opportunityFormat(source).format;
  assert.equal(role.strict, true);
  const allowed = role.schema.properties.requirements.items.properties.sourceQuote.enum;
  assert.ok(allowed.includes('I organised weekly reading groups.'));
  for (const quote of allowed.filter(Boolean)) {
    assert.doesNotThrow(() => validateOpportunity({ summary: 'Reading groups', requirements: [{ text: 'Organise groups', basis: 'stated', sourceQuote: quote }] }, source));
  }
  for (const quote of reflectionFormat(source).format.schema.properties.actionQuote.enum.filter(Boolean)) {
    assert.doesNotThrow(() => validateReflection({ situationQuote: '', actionQuote: quote, outcomeQuote: '', followUpQuestion: '' }, source));
  }
  assert.ok(!allowed.includes('I led a national literacy programme.'));
});
test('generation schemas match question count and quote-backed profile requirements', () => {
  assert.equal(questionsFormat().format.schema.properties.questions.maxItems, 8);
  const evidence = artifactFormat('profile', ['I did not manage the budget.']).format.schema.properties.profileCards.items.properties.evidence;
  assert.deepEqual(evidence.items.enum, ['I did not manage the budget.']);
  assert.deepEqual(artifactFormat('resume', []).format.schema.required, ['resumeMarkdown']);
});

test('multiline job text supplies only control-character-free literal quotes to OpenAI', () => {
  const source = 'Teach business courses.\n\nBuild industry partnerships.\nMentor students.';
  const choices = opportunityFormat(source).format.schema.properties.requirements.items.properties.sourceQuote.enum;
  assert.ok(choices.includes('Build industry partnerships.'));
  assert.ok(choices.every(value => !/[\u0000-\u001f]/.test(value)));
  assert.ok(choices.every(value => source.includes(value)));
});
