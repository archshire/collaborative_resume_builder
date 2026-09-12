const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateOpportunity } = require('../server/opportunity.cjs');
const description = 'Coordinate weekly sessions and keep accurate attendance records.';
const valid = () => ({ summary: 'Coordinate sessions reliably.', requirements: [
  { text: 'Coordinate weekly sessions', basis: 'stated', sourceQuote: 'Coordinate weekly sessions' },
  { text: 'Fewer last-minute disruptions may be useful.', basis: 'interpretation', sourceQuote: '' },
] });
test('opportunity analysis distinguishes stated sources and interpretations', () => assert.deepEqual(validateOpportunity(valid(), description), valid()));
test('opportunity validation rejects fabricated quotes, mistyped fields and invalid categories', () => {
  for (const change of [p => p.requirements[0].sourceQuote = 'Invented quote', p => p.requirements[0].basis = 'confirmed', p => p.requirements = [], p => p.summary = {}, p => p.requirements[0].sourceQuote = '']) {
    const payload = valid(); change(payload); assert.throws(() => validateOpportunity(payload, description));
  }
});
