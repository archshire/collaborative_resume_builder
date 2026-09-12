// Shape constraints complement (never replace) the server's semantic validators.
const text = { type: 'string' };
const object = properties => ({ type: 'object', additionalProperties: false, properties, required: Object.keys(properties) });
const list = (items, minItems, maxItems) => ({ type: 'array', items, minItems, maxItems });
const format = (name, schema) => ({ format: { type: 'json_schema', name, strict: true, schema } });
function excerpts(source, max) {
  return [...new Set([source, ...source.split(/(?<=[.!?])\s+|\n/)].map(s => s.trim()).filter(s => s && s.length <= max && !/[\u0000-\u001f]/.test(s)))];
}
function opportunityFormat(description) {
  const quotes = ['', ...excerpts(description, 3000)];
  return format('opportunity', object({ summary: text, requirements: list(object({
    text, basis: { type: 'string', enum: ['stated', 'interpretation'] }, sourceQuote: { type: 'string', enum: quotes },
  }), 1, 8) }));
}
function reflectionFormat(answer) {
  const quote = { type: 'string', enum: ['', ...excerpts(answer, 12000)] };
  return format('reflection', object({ situationQuote: quote, actionQuote: quote, outcomeQuote: quote, followUpQuestion: text }));
}
function questionsFormat() { return format('interview_questions', object({ questions: list(text, 8, 8) })); }
function artifactFormat(mode, quotes) {
  if (mode === 'resume') return format('resume', object({ resumeMarkdown: text }));
  const allowed = [...new Set(quotes.flatMap(q => excerpts(q, 10000)))];
  return format('candidate_profile', object({
    candidateProfileMarkdown: text,
    profileCards: list(object({ label: text, evidenceStrength: { type: 'number', minimum: 0, maximum: 100 },
      evidence: list(allowed.length ? { type: 'string', enum: allowed } : text, 0, allowed.length ? 8 : 0), gap: text }), 4, 6),
    feedbackMarkdown: text, followUpQuestions: list(text, 5, 8),
  }));
}
module.exports = { opportunityFormat, reflectionFormat, questionsFormat, artifactFormat };
