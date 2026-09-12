const directFields = new Set(['Name', 'Email', 'Phone', 'Location', 'LinkedIn', 'GitHub', 'Portfolio',
  'Education', 'Certifications', 'Technical skills', 'Other notes from uploaded doc']);

function readDirectInfo(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid applicant information.');
  const entries = Object.entries(value);
  if (entries.length > directFields.size) throw new Error('Too many applicant fields.');
  return entries.map(([key, text]) => {
    if (!directFields.has(key) || typeof text !== 'string' || text.length > 15000) {
      throw new Error('Invalid applicant information field.');
    }
    return [key, text.trim()];
  }).filter(([, text]) => text);
}

function analyzeCandidateEvidence(transcript, candidateName, directInfo = {}) {
  const accepted = [];
  let turn = null;
  let ignoreSection = false;
  const flush = () => { if (turn) accepted.push(turn.join('\n')); turn = null; };
  for (const raw of transcript.split(/\r?\n/)) {
    const line = raw.trim();
    if (/^(INITIAL INTERVIEW TRANSCRIPT|FOLLOW-UP INTERVIEW TRANSCRIPT)$/i.test(line)) {
      flush(); ignoreSection = false; continue;
    }
    if (/^(UPDATED RESUME DRAFT|EXISTING RESUME DRAFT|APPLICANT-PROVIDED DIRECT INFORMATION)$/i.test(line)) {
      flush(); ignoreSection = true; continue;
    }
    if (/^Transcript chunk \d+\s+-/.test(line)) { flush(); continue; }
    if (ignoreSection || !line) continue;
    const match = line.match(/^([^:]{1,100}):\s*(.*)$/);
    if (match) {
      flush();
      const label = match[1].trim().toLowerCase();
      const reserved = /^(interviewer|recruiter|unknown speaker|speaker\s*\d+)$/i.test(label);
      if (!reserved && (/^(applicant|candidate|student)$/.test(label) ||
          (candidateName && label === candidateName.toLowerCase()))) turn = [match[2]];
    } else if (turn) {
      turn.push(line);
    }
  }
  flush();
  const direct = readDirectInfo(directInfo);
  // No word-count bypass, technology whitelist, or global irrelevant-word blacklist.
  // This is a conservative readiness check, not verification of the truth of a claim.
  const concrete = accepted.some(text =>
    text.split(/\s+/).length >= 6 &&
    /\b(built|developed|created|implemented|designed|fixed|debugged|tested|deployed|used|managed|collaborated|completed|worked|wrote|made|organized|organised|taught|trained|served|cared|supported|helped|led|delivered|repaired|earned|graduated|studied|certified|volunteered|operated|prepared|assisted|coordinated)\b/i.test(text) &&
    !/^\s*(this is (a )?test|testing)\b/i.test(text));
  const sufficient = concrete || direct.some(([key]) => ['Education', 'Certifications', 'Technical skills', 'Other notes from uploaded doc'].includes(key));
  return {
    sufficient,
    reason: sufficient ? 'Applicant sources are available for a cautious draft.' :
      'Confirm speaker roles using Applicant: labels and add a concrete work, study, or project example, or applicant-provided qualifications. Unknown speakers and interviewer text are excluded.',
    text: accepted.map(text => `Applicant: ${text}`).join('\n\n'),
    directText: direct.map(([key, value]) => `${key}: ${value}`).join('\n'),
    quotes: [...accepted, ...direct.map(([, value]) => value)],
  };
}
module.exports = { analyzeCandidateEvidence, readDirectInfo };
