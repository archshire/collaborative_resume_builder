const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateReflection } = require('../server/reflection.cjs');
const source = 'I helped run a book swap. I contacted two replacement volunteers. We opened on time.';
const valid = () => ({ situationQuote: 'I helped run a book swap.', actionQuote: 'I contacted two replacement volunteers.', outcomeQuote: 'We opened on time.', followUpQuestion: '' });
test('reflection accepts source sentences and missing outcomes without inventing claims', () => {
  assert.deepEqual(validateReflection(valid(), source), valid());
  assert.equal(validateReflection({ ...valid(), outcomeQuote: '' }, source).outcomeQuote, '');
});
test('reflection rejects invented, partial, mistyped and empty excerpts', () => {
  for (const result of [null, [], { ...valid(), outcomeQuote: 'I increased attendance by 50%.' },
    { ...valid(), actionQuote: 3 }, { ...valid(), actionQuote: 'contacted two replacement volunteers' },
    { ...valid(), situationQuote: '', actionQuote: '', outcomeQuote: '' }, { ...valid(), followUpQuestion: 'x'.repeat(301) }]) {
    assert.throws(() => validateReflection(result, source));
  }
  assert.throws(() => validateReflection({ ...valid(), actionQuote: 'used a booking system' }, 'I have never used a booking system.'));
});
