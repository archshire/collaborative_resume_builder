function object(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`Invalid ${field}: expected an object.`);
  return value;
}
function string(value, field, max = 30000, allowEmpty = false) {
  if (typeof value !== 'string' || (!allowEmpty && !value.trim()) || value.length > max) {
    throw new Error(`Invalid ${field}: expected ${allowEmpty ? 'a' : 'a nonempty'} string of at most ${max} characters.`);
  }
  return value.trim();
}
function array(value, field, min, max, validate) {
  if (!Array.isArray(value) || value.length < min || value.length > max) throw new Error(`Invalid ${field}: expected ${min} to ${max} entries.`);
  return value.map(validate);
}
function normalizeQuote(value) { return value.replace(/\s+/g, ' ').trim(); }
function validateArtifacts(payload, providerName, mode, quotes = []) {
  object(payload, `${providerName} artifact`);
  if (mode === 'resume') {
    return { resumeMarkdown: string(payload.resumeMarkdown, 'resumeMarkdown') };
  }
  if (mode !== 'profile') throw new Error('Invalid artifact mode.');
  // Require whole source sentences/turns, not arbitrary substrings that can drop a negation.
  const supported = new Set(quotes.flatMap(quote => [quote, ...quote.split(/(?<=[.!?])\s+|\n/)]).map(normalizeQuote));
  const profileCards = array(payload.profileCards, 'profileCards', 4, 6, card => {
    object(card, 'profile card');
    const label = string(card.label, 'label', 120);
    const gap = string(card.gap, 'gap', 2000, true);
    if (typeof card.evidenceStrength !== 'number' || !Number.isFinite(card.evidenceStrength) ||
        card.evidenceStrength < 0 || card.evidenceStrength > 100) throw new Error('Invalid evidenceStrength: expected a number from 0 to 100.');
    const evidence = array(card.evidence, 'evidence', 0, 8, item => {
      const quote = string(item, 'evidence quote', 10000);
      if (!supported.has(normalizeQuote(quote))) throw new Error('Evidence quote is not present in the applicant sources.');
      return quote;
    });
    if (card.evidenceStrength > 0 && !evidence.length) throw new Error('Positive evidence strength requires a supporting quote.');
    return { label, gap, evidenceStrength: card.evidenceStrength, evidence };
  });
  return {
    candidateProfileMarkdown: string(payload.candidateProfileMarkdown, 'candidateProfileMarkdown'),
    profileCards,
    feedbackMarkdown: string(payload.feedbackMarkdown, 'feedbackMarkdown', 15000),
    followUpQuestions: array(payload.followUpQuestions, 'followUpQuestions', 5, 8, item => string(item, 'follow-up question', 500)),
  };
}
function validateInterviewQuestions(payload, providerName) {
  object(payload, `${providerName} questions`);
  return array(payload.questions, 'questions', 8, 10, item => {
    const question = string(item, 'question', 500).replace(/\s+/g, ' ');
    if (question.split(' ').length > 18) throw new Error('Interview questions must be at most 18 words.');
    return question;
  });
}
function validateJobExtraction(payload, providerName) {
  object(payload, `${providerName} job extraction`);
  if (payload.status === 'not_job') return { status: 'not_job' };
  if (payload.status !== 'ok') throw new Error('Invalid extraction status.');
  const company = string(payload.company, 'company', 2000);
  const jobDescription = string(payload.jobDescription, 'jobDescription', 30000);
  if (jobDescription.length < 80) throw new Error('Job description is too short.');
  return { status: 'ok', company, jobDescription };
}
module.exports = { object, string, validateArtifacts, validateInterviewQuestions, validateJobExtraction };
