const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');
const { URL } = require('url');

const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const port = Number(process.env.PORT || 4173);
const maxBodyBytes = 28 * 1024 * 1024;

loadEnv(path.join(rootDir, '.env'));

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

    if (req.method === 'POST' && url.pathname === '/api/transcribe') {
      await handleTranscribe(req, res);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/generate-artifacts') {
      await handleGenerateArtifacts(req, res);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/extract-job-url') {
      await handleExtractJobUrl(req, res);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/extract-job-document') {
      await handleExtractJobDocument(req, res);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/generate-interview-questions') {
      await handleGenerateInterviewQuestions(req, res);
      return;
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      sendJson(res, 405, { error: 'Method not allowed.' });
      return;
    }

    serveStatic(url.pathname, res);
  } catch (error) {
    sendJson(res, 500, { error: error.message || 'Unexpected server error.' });
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log(`collaborative_resume_builder listening on http://localhost:${port}`);
});

async function handleTranscribe(req, res) {
  const body = await readJsonBody(req);
  const audioData = String(body.data || '');
  const mimeType = String(body.mimeType || 'audio/webm');
  const name = String(body.name || 'interview-audio.webm');
  const applicantName = String(body.applicantName || 'Applicant').trim() || 'Applicant';

  if (!audioData) {
    sendJson(res, 400, { error: 'Missing audio data.' });
    return;
  }

  const prompt = [
    'You are a transcription engine.',
    'Transcribe only the words actually spoken in the audio.',
    'Do not answer questions heard in the audio.',
    'Do not role-play as the interviewer or candidate.',
    'Do not invent missing answers, names, skills, or context.',
    'Do not summarize, rewrite, polish, or generate a resume.',
    'If the audio contains only a question, transcribe only that question.',
    'If speech is unclear, write [inaudible] for that segment.',
    'If there is no intelligible speech, return [NO INTELLIGIBLE SPEECH DETECTED].',
    'Separate speaker turns onto new lines when possible.',
    'Use "Recruiter:" and "Applicant:" speaker labels when the roles are reasonably clear.',
    'If the speaker changes but the role is unclear, use "Speaker 1:" and "Speaker 2:".',
    'Do not collapse the whole interview into one paragraph.',
    'Return transcript text only.',
  ].join(' ');

  const errors = [];

  if (process.env.GEMINI_API_KEY) {
    try {
      const transcript = await transcribeWithGemini(process.env.GEMINI_API_KEY, prompt, audioData, mimeType);
      const formatted = await formatTranscriptWithFallback(transcript, applicantName);
      sendJson(res, 200, { transcript: formatted, provider: 'gemini' });
      return;
    } catch (error) {
      errors.push(`Gemini: ${error.message || error}`);
    }
  } else {
    errors.push('Gemini: missing GEMINI_API_KEY in .env.');
  }

  if (process.env.OPENAI_API_KEY) {
    try {
      const transcript = await transcribeWithOpenAI(process.env.OPENAI_API_KEY, prompt, audioData, mimeType, name);
      const formatted = await formatTranscriptWithFallback(transcript, applicantName);
      sendJson(res, 200, { transcript: formatted, provider: 'openai' });
      return;
    } catch (error) {
      errors.push(`OpenAI: ${error.message || error}`);
    }
  } else {
    errors.push('OpenAI: missing OPENAI_API_KEY in .env.');
  }

  sendJson(res, 502, {
    error: 'Automated transcription failed for all configured providers.',
    details: errors,
  });
}

async function handleGenerateArtifacts(req, res) {
  const body = await readJsonBody(req);
  const candidateName = String(body.candidateName || '').trim();
  const target = String(body.target || '').trim();
  const transcript = String(body.transcript || '').trim();
  const existingResume = String(body.existingResume || '').trim();
  const mode = body.mode === 'profile' ? 'profile' : 'resume';

  if (!transcript) {
    sendJson(res, 400, { error: 'Missing transcript.' });
    return;
  }

  const evidenceCheck = analyzeCandidateEvidence(transcript, candidateName);
  if (!evidenceCheck.sufficient) {
    sendJson(res, 200, addProvider(
      buildInsufficientEvidenceArtifact(mode, candidateName, evidenceCheck.reason),
      'local-evidence-gate',
    ));
    return;
  }

  const prompt = buildArtifactPrompt(mode, candidateName, target, transcript, existingResume);
  const errors = [];

  if (process.env.GEMINI_API_KEY) {
    try {
      const parsed = await generateArtifactsWithGemini(process.env.GEMINI_API_KEY, prompt, mode);
      sendJson(res, 200, addProvider(parsed, 'gemini'));
      return;
    } catch (error) {
      errors.push(`Gemini: ${error.message || error}`);
    }
  } else {
    errors.push('Gemini: missing GEMINI_API_KEY in .env.');
  }

  if (process.env.OPENAI_API_KEY) {
    try {
      const parsed = await generateArtifactsWithOpenAI(process.env.OPENAI_API_KEY, prompt, mode);
      sendJson(res, 200, addProvider(parsed, 'openai'));
      return;
    } catch (error) {
      errors.push(`OpenAI: ${error.message || error}`);
    }
  } else {
    errors.push('OpenAI: missing OPENAI_API_KEY in .env.');
  }

  sendJson(res, 502, {
    error: mode === 'profile'
      ? 'Candidate profile generation failed for all configured providers.'
      : 'Resume generation failed for all configured providers.',
    details: errors,
  });
}

async function handleExtractJobUrl(req, res) {
  const body = await readJsonBody(req);
  const rawUrl = String(body.url || '').trim();

  let parsedUrl;
  try {
    parsedUrl = new URL(rawUrl);
  } catch (error) {
    sendJson(res, 400, { status: 'restricted', error: 'Enter a valid job application URL.' });
    return;
  }

  if (!/^https?:$/.test(parsedUrl.protocol)) {
    sendJson(res, 400, { status: 'restricted', error: 'Only http and https job links can be extracted.' });
    return;
  }

  let page;
  try {
    page = await fetchPageText(parsedUrl.toString());
  } catch (error) {
    sendJson(res, 200, {
      status: 'restricted',
      error: 'This page has restrictions which do not allow extraction. Copy and paste the company and job description below.',
    });
    return;
  }

  if (!page.text || page.text.length < 300 || page.restricted) {
    sendJson(res, 200, {
      status: 'restricted',
      error: 'This page has restrictions which do not allow extraction. Copy and paste the company and job description below.',
    });
    return;
  }

  if (!hasJobPostingSignals(page.text, parsedUrl)) {
    sendJson(res, 200, { status: 'not_job' });
    return;
  }

  const prompt = buildJobExtractionPrompt(parsedUrl.toString(), page.text);
  const errors = [];

  if (process.env.GEMINI_API_KEY) {
    try {
      const extracted = await extractJobWithGemini(process.env.GEMINI_API_KEY, prompt);
      sendJson(res, 200, addProvider(extracted, 'gemini'));
      return;
    } catch (error) {
      errors.push(`Gemini: ${error.message || error}`);
    }
  } else {
    errors.push('Gemini: missing GEMINI_API_KEY in .env.');
  }

  if (process.env.OPENAI_API_KEY) {
    try {
      const extracted = await extractJobWithOpenAI(process.env.OPENAI_API_KEY, prompt);
      sendJson(res, 200, addProvider(extracted, 'openai'));
      return;
    } catch (error) {
      errors.push(`OpenAI: ${error.message || error}`);
    }
  } else {
    errors.push('OpenAI: missing OPENAI_API_KEY in .env.');
  }

  sendJson(res, 502, {
    status: 'restricted',
    error: 'Job link extraction failed for all configured AI providers.',
    details: errors,
  });
}

async function handleGenerateInterviewQuestions(req, res) {
  const body = await readJsonBody(req);
  const company = String(body.company || '').trim();
  const jobDescription = String(body.jobDescription || '').trim();

  if (!company && !jobDescription) {
    sendJson(res, 400, { error: 'Add company or job information before generating questions.' });
    return;
  }

  const prompt = buildInterviewQuestionPrompt(company, jobDescription);
  const errors = [];

  if (process.env.GEMINI_API_KEY) {
    try {
      const questions = await generateInterviewQuestionsWithGemini(process.env.GEMINI_API_KEY, prompt);
      sendJson(res, 200, addProvider({ questions }, 'gemini'));
      return;
    } catch (error) {
      errors.push(`Gemini: ${error.message || error}`);
    }
  } else {
    errors.push('Gemini: missing GEMINI_API_KEY in .env.');
  }

  if (process.env.OPENAI_API_KEY) {
    try {
      const questions = await generateInterviewQuestionsWithOpenAI(process.env.OPENAI_API_KEY, prompt);
      sendJson(res, 200, addProvider({ questions }, 'openai'));
      return;
    } catch (error) {
      errors.push(`OpenAI: ${error.message || error}`);
    }
  } else {
    errors.push('OpenAI: missing OPENAI_API_KEY in .env.');
  }

  sendJson(res, 502, {
    error: 'Interview question generation failed for all configured providers.',
    details: errors,
  });
}

async function handleExtractJobDocument(req, res) {
  const body = await readJsonBody(req);
  const name = String(body.name || 'uploaded job document').trim();
  const text = String(body.text || '').trim();

  if (!text || text.length < 120 || looksLikeBinaryDocumentText(text)) {
    sendJson(res, 200, {
      status: 'restricted',
      error: 'This document could not be read for extraction. Copy and paste the company and job description below.',
    });
    return;
  }

  if (!hasJobPostingSignals(text, null)) {
    sendJson(res, 200, { status: 'not_job' });
    return;
  }

  const prompt = buildJobExtractionPrompt(`uploaded document: ${name}`, text);
  const errors = [];

  if (process.env.GEMINI_API_KEY) {
    try {
      const extracted = await extractJobWithGemini(process.env.GEMINI_API_KEY, prompt);
      sendJson(res, 200, addProvider(extracted, 'gemini'));
      return;
    } catch (error) {
      errors.push(`Gemini: ${error.message || error}`);
    }
  } else {
    errors.push('Gemini: missing GEMINI_API_KEY in .env.');
  }

  if (process.env.OPENAI_API_KEY) {
    try {
      const extracted = await extractJobWithOpenAI(process.env.OPENAI_API_KEY, prompt);
      sendJson(res, 200, addProvider(extracted, 'openai'));
      return;
    } catch (error) {
      errors.push(`OpenAI: ${error.message || error}`);
    }
  } else {
    errors.push('OpenAI: missing OPENAI_API_KEY in .env.');
  }

  sendJson(res, 502, {
    status: 'restricted',
    error: 'Job document extraction failed for all configured AI providers.',
    details: errors,
  });
}

function looksLikeBinaryDocumentText(text) {
  const sample = String(text || '').slice(0, 2000);
  if (/^%PDF-|^PK\u0003\u0004/.test(sample)) {
    return true;
  }

  const controlCharacters = sample.match(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g) || [];
  return sample.length > 0 && controlCharacters.length / sample.length > 0.02;
}

function buildInterviewQuestionPrompt(company, jobDescription) {
  return [
    'You generate interview questions for a resume-building interview.',
    'Use the company and job description to create questions that help an interviewer collect concrete applicant evidence.',
    'Generate 8 to 10 questions.',
    'Each question must be short, direct, and no more than 18 words.',
    'Ask immediately. Do not repeat the role, company, or contextual information in the question.',
    'Ask for specific examples, projects, tools, outcomes, constraints, collaboration, or gaps relevant to the role.',
    'Do not ask generic questions that could apply to any job.',
    'Do not invent company details beyond the provided context.',
    'Return valid JSON only. Do not wrap it in markdown fences.',
    'Schema:',
    '{',
    '  "questions": ["string"]',
    '}',
    '',
    `COMPANY:\n${company || 'No company information provided.'}`,
    '',
    `JOB DESCRIPTION:\n${jobDescription || 'No job description provided.'}`,
  ].join('\n');
}

function validateInterviewQuestions(payload, providerName) {
  if (!payload || typeof payload !== 'object') {
    throw new Error(`${providerName} returned no interview question JSON.`);
  }

  const questions = Array.isArray(payload.questions)
    ? payload.questions.map((question) => String(question || '').trim()).filter(Boolean)
    : [];

  if (questions.length < 8 || questions.length > 10) {
    throw new Error(`${providerName} did not return 8 to 10 interview questions.`);
  }

  return questions.map((question) => question.replace(/\s+/g, ' ').trim());
}

function hasJobPostingSignals(pageText, parsedUrl) {
  const text = String(pageText || '').toLowerCase();
  const hostname = parsedUrl ? String(parsedUrl.hostname || '').toLowerCase() : '';
  const pathname = parsedUrl ? String(parsedUrl.pathname || '').toLowerCase() : '';
  const urlText = `${hostname} ${pathname}`;

  const strongSignals = [
    'job description',
    'job summary',
    'job responsibilities',
    'responsibilities',
    'requirements',
    'qualifications',
    'what you will do',
    'what you\'ll do',
    'about the role',
    'about this role',
    'apply now',
    'apply for this job',
    'submit application',
    'employment type',
    'salary range',
    'job req',
    'requisition',
    'vacancy',
    'candidate profile',
  ];

  const roleSignals = [
    'engineer',
    'developer',
    'designer',
    'manager',
    'analyst',
    'specialist',
    'consultant',
    'architect',
    'faculty',
    'intern',
    'assistant',
    'associate',
    'officer',
    'lead',
    'director',
  ];

  const careerUrlSignals = [
    'job',
    'jobs',
    'career',
    'careers',
    'position',
    'opening',
    'requisition',
    'vacancy',
  ];

  const strongCount = strongSignals.filter((signal) => text.includes(signal)).length;
  const roleCount = roleSignals.filter((signal) => text.includes(signal)).length;
  const urlCount = careerUrlSignals.filter((signal) => urlText.includes(signal)).length;

  if (strongCount >= 2) return true;
  if (strongCount >= 1 && roleCount >= 1) return true;
  if (urlCount >= 1 && (strongCount >= 1 || roleCount >= 1)) return true;
  return false;
}

function buildJobExtractionPrompt(url, pageText) {
  return [
    'You extract job application context for a resume builder.',
    'Classify the page text carefully.',
    'If this is not a job posting, career listing, or application page with a specific role, return {"status":"not_job"}.',
    'If it is a job posting but the company cannot be identified, infer the company only from clear page text or the domain.',
    'The jobDescription should include title, location if present, role summary, responsibilities, requirements, qualifications, and useful keywords.',
    'Do not invent missing role details.',
    'Return valid JSON only. Do not wrap it in markdown fences.',
    'Schema:',
    '{',
    '  "status": "ok" | "not_job",',
    '  "company": "string",',
    '  "jobDescription": "string"',
    '}',
    '',
    `URL: ${url}`,
    '',
    `PAGE TEXT:\n${pageText.slice(0, 24000)}`,
  ].join('\n');
}

function validateJobExtraction(payload, providerName) {
  if (!payload || typeof payload !== 'object') {
    throw new Error(`${providerName} returned no job extraction JSON.`);
  }

  if (payload.status === 'not_job') {
    return { status: 'not_job' };
  }

  if (payload.status !== 'ok') {
    throw new Error(`${providerName} returned an invalid extraction status.`);
  }

  const company = String(payload.company || '').trim();
  const jobDescription = String(payload.jobDescription || '').trim();

  if (!company || !jobDescription || jobDescription.length < 80) {
    return { status: 'not_job' };
  }

  return {
    status: 'ok',
    company,
    jobDescription,
  };
}

async function extractJobWithGemini(apiKey, prompt) {
  const payload = {
    model: process.env.GEMINI_TEXT_MODEL || 'gemini-3.5-flash',
    input: [{ type: 'text', text: prompt }],
  };

  const response = await postGemini(apiKey, payload);
  const outputText = extractOutputText(response);
  return validateJobExtraction(parseJsonOutput(outputText), 'Gemini');
}

async function extractJobWithOpenAI(apiKey, prompt) {
  const payload = {
    model: process.env.OPENAI_TEXT_MODEL || 'gpt-4o-mini',
    input: prompt,
  };

  const response = await postOpenAiJson(apiKey, '/v1/responses', payload);
  const outputText = extractOutputText(response);
  return validateJobExtraction(parseJsonOutput(outputText), 'OpenAI');
}

async function generateInterviewQuestionsWithGemini(apiKey, prompt) {
  const payload = {
    model: process.env.GEMINI_TEXT_MODEL || 'gemini-3.5-flash',
    input: [{ type: 'text', text: prompt }],
  };

  const response = await postGemini(apiKey, payload);
  const outputText = extractOutputText(response);
  return validateInterviewQuestions(parseJsonOutput(outputText), 'Gemini');
}

async function generateInterviewQuestionsWithOpenAI(apiKey, prompt) {
  const payload = {
    model: process.env.OPENAI_TEXT_MODEL || 'gpt-4o-mini',
    input: prompt,
  };

  const response = await postOpenAiJson(apiKey, '/v1/responses', payload);
  const outputText = extractOutputText(response);
  return validateInterviewQuestions(parseJsonOutput(outputText), 'OpenAI');
}

function buildArtifactPrompt(mode, candidateName, target, transcript, existingResume) {
  const common = [
    'You are an evidence-based candidate document assistant for a 42 student.',
    'Use the TRANSCRIPT as the only source for candidate claims.',
    'If the transcript includes APPLICANT-PROVIDED DIRECT INFORMATION, treat those fields as applicant-supplied evidence for contact details, links, education, certifications, dates, and skill lists.',
    'Prefer APPLICANT-PROVIDED DIRECT INFORMATION over interview inference for contact, education, certifications, and exact technical skill categories.',
    'If an EXISTING RESUME DRAFT is provided, use it as the previous draft to revise, not as independent evidence.',
    'Use the TARGET JOB/TASK only to evaluate fit and identify missing evidence.',
    'Do not invent skills, tools, experience, dates, achievements, or project details.',
    'Do not convert target job requirements into candidate skills unless the transcript explicitly supports them.',
    'Do not treat interviewer questions as candidate evidence.',
    'Distinguish unsupported claims from backed evidence. A claim like "I am good at JavaScript" is not enough unless the transcript also gives a project, tool use, task, duration, result, qualification, or concrete example.',
    'Do not treat irrelevant, joking, absurd, sexual, manipulative, or non-work-related statements as evidence of job skill.',
    'If the transcript contains broad boasts such as being good at all languages without concrete examples, put them in missing evidence or feedback instead of candidate claims.',
    'If the transcript contains only test text, interviewer prompts, or too little applicant evidence, say there is insufficient evidence instead of drafting a document.',
    'If a required job skill is not evidenced in the transcript, put it in gaps and ask a follow-up question.',
    'Return valid JSON only. Do not wrap it in markdown fences.',
  ];

  const modeSpecific = mode === 'profile'
    ? [
        'Generate only the candidate profile and interview feedback artifacts.',
        'Schema:',
        '{',
        '  "candidateProfileMarkdown": "string",',
        '  "profileCards": [{"label":"string","evidenceStrength":0,"evidence":["string"],"gap":"string"}],',
        '  "feedbackMarkdown": "string",',
        '  "followUpQuestions": ["string"]',
        '}',
        'candidateProfileMarkdown must be a readable task-fit document, not a resume.',
        'Use this exact Markdown structure for candidateProfileMarkdown:',
        '# Candidate Profile: CANDIDATE NAME',
        '## Task Context',
        'One concise paragraph describing the target task, opportunity, hackathon, role, or project from TARGET JOB/TASK.',
        '## Fit Summary',
        '2 to 4 sentences explaining how the candidate appears relevant to the target, grounded only in transcript evidence.',
        '## Relevant Strengths',
        '- Strength connected to target task, with concrete interview evidence.',
        '## Possible Contribution',
        'Describe the role this candidate could reasonably play in the task, team, hackathon, or project.',
        '## Evidence From Interview',
        '- Specific transcript-backed evidence item.',
        '## Gaps To Clarify',
        '- Missing or weak evidence that should be asked about before relying on this profile.',
        '## Suggested Follow-Up',
        '- One practical next question or check.',
        'profileCards must contain 4 to 6 cards. Each card must include label, evidenceStrength, evidence, and gap.',
        'profileCards are supporting data for the UI. The candidateProfileMarkdown is the primary document.',
        'feedbackMarkdown must explain what evidence is strong, what is weak, and what the interviewer should clarify next.',
        'followUpQuestions must contain 5 to 8 concrete interview questions.',
        'Do not include resumeMarkdown.',
      ]
    : [
        'Generate only the resume artifact.',
        'Schema:',
        '{',
        '  "resumeMarkdown": "string"',
        '}',
        'resumeMarkdown must be a polished resume in the same compact one-page format as the reference resume provided by the user.',
        'Use this exact Markdown structure when evidence exists:',
        '# CANDIDATE NAME IN UPPERCASE',
        'Email: value | Phone: value | Location: value',
        'LinkedIn: value | GitHub: value',
        '## WORK EXPERIENCE',
        '**Organization or Project Name** | **Date range**',
        '*Role or project title*',
        '- Bullet with concrete action, tool, scope, or result.',
        '**Tech:** comma-separated technologies',
        '## EDUCATION',
        '**School / Institution** | **Date range**',
        '*Credential or programme*',
        '## CERTIFICATIONS',
        '**Certification name** | **Year**',
        '*Issuer*',
        '- One concise evidence-based detail if available.',
        '## TECH SKILLS',
        '**Languages:** comma-separated skills',
        '**Web & Software:** comma-separated skills',
        '**Tools:** comma-separated skills',
        'Omit empty contact lines, empty sections, and unsupported categories.',
        'Use WORK EXPERIENCE for real employment, internships, apprenticeships, national service, tutoring, freelance work, and substantial project work; use the organization/project name as the left side and the date range as the right side.',
        'Keep the resume compact: 3 to 5 bullets for the strongest experience, 1 to 3 bullets for smaller entries, and no target-fit summary or analysis sections.',
        'Keep bullets resume-ready but evidence-governed.',
        'If the transcript contains initial and follow-up sections, combine both into one stronger updated resume.',
        'If an existing resume draft is provided, preserve useful supported structure and improve it with new follow-up evidence.',
        'Write concise resume-ready bullets, but omit uncertain or missing claims instead of pretending they are proven.',
        'Do not include Missing Evidence, Target Fit Summary, Evidence-Based Skills, Project Evidence, Communication Evidence, Draft Resume Bullets, notes to the interviewer, or any analysis text inside resumeMarkdown.',
        'Do not include resumeLatex, profileCards, feedbackMarkdown, or followUpQuestions.',
      ];

  return [
    ...common,
    ...modeSpecific,
    '',
    `CANDIDATE NAME: ${candidateName || 'Unknown / infer if explicitly spoken'}`,
    '',
    `TARGET JOB/TASK:\n${target || 'No target provided.'}`,
    '',
    `EXISTING RESUME DRAFT:\n${existingResume || 'None provided.'}`,
    '',
    `TRANSCRIPT:\n${transcript}`,
  ].join('\n');
}

function analyzeCandidateEvidence(transcript, candidateName) {
  const cleaned = String(transcript || '')
    .replace(/^Transcript chunk \d+\s+-\s+.*$/gim, '')
    .trim();

  if (/evidence-based resume draft cannot be generated yet/i.test(cleaned) ||
      /insufficient applicant evidence/i.test(cleaned) ||
      /no resume bullets generated/i.test(cleaned)) {
    return {
      sufficient: false,
      reason: 'The current resume/transcript is already marked as insufficient evidence.',
    };
  }

  const lines = cleaned.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const labelledLines = lines
    .map((line) => {
      const match = line.match(/^([^:]{1,50}):\s*(.+)$/);
      return match ? { label: match[1].trim(), text: match[2].trim() } : null;
    })
    .filter(Boolean);

  const hasInterviewerLabels = labelledLines.some((line) => /^(interviewer|recruiter)$/i.test(line.label));
  const applicantNamePattern = candidateName ? new RegExp(`^${escapeRegExp(candidateName)}$`, 'i') : null;
  const applicantLines = labelledLines.filter((line) => (
    /^(applicant|candidate|student)$/i.test(line.label) ||
    (applicantNamePattern && applicantNamePattern.test(line.label)) ||
    (!/^(interviewer|recruiter|speaker\s*1)$/i.test(line.label) && /^speaker\s*2$/i.test(line.label))
  ));

  if (hasInterviewerLabels && applicantLines.length === 0) {
    return {
      sufficient: false,
      reason: 'The transcript contains interviewer/recruiter text but no applicant answers.',
    };
  }

  const applicantText = applicantLines.length
    ? applicantLines.map((line) => line.text).join(' ')
    : cleaned;

  const words = applicantText.match(/\b[\w'-]+\b/g) || [];
  const evidenceTerms = [
    'project', 'built', 'build', 'developed', 'created', 'implemented', 'designed',
    'fixed', 'debugged', 'tested', 'deployed', 'used', 'learned', 'managed',
    'collaborated', 'communicated', 'deadline', 'html', 'css', 'javascript', 'typescript',
    'python', 'php', 'git', 'react', 'vue', 'backend', 'front-end', 'frontend',
    'database', 'api', 'algorithm', 'problem', 'team', 'client',
  ];
  const lowerText = applicantText.toLowerCase();
  const evidenceTermCount = evidenceTerms.filter((term) => lowerText.includes(term)).length;
  const concreteEvidenceTerms = [
    'project', 'built', 'developed', 'created', 'implemented', 'designed', 'fixed',
    'debugged', 'tested', 'deployed', 'used', 'learned', 'managed', 'collaborated',
    'completed', 'worked on', 'my role', 'i made', 'i wrote', 'i coded', 'i built',
  ];
  const concreteEvidenceCount = concreteEvidenceTerms.filter((term) => lowerText.includes(term)).length;
  const irrelevantOrAbsurd = [
    'seduce', 'seducing', 'toilet', 'all computer languages', 'right people',
    'people who know that language', 'good at every language',
  ].some((term) => lowerText.includes(term));
  const broadUnbackedClaim = /\b(i am|i'm|im)\s+(very\s+)?(good|great|excellent|proficient|fluent|expert)\s+at\b/i.test(applicantText) &&
    concreteEvidenceCount === 0;
  const testOnly = /\b(this is (a )?test|testing|purely a functionality test)\b/i.test(applicantText) && words.length < 35;

  if (testOnly) {
    return {
      sufficient: false,
      reason: 'The transcript appears to be a functionality test, not an applicant interview.',
    };
  }

  if (words.length < 25) {
    return {
      sufficient: false,
      reason: 'The transcript has too few applicant words to support resume claims.',
    };
  }

  if (words.length < 60 && evidenceTermCount === 0) {
    return {
      sufficient: false,
      reason: 'The transcript does not contain enough concrete applicant evidence about projects, tools, skills, or work behavior.',
    };
  }

  if (irrelevantOrAbsurd) {
    return {
      sufficient: false,
      reason: 'The transcript contains irrelevant or non-work-related claims that should not be treated as resume evidence.',
    };
  }

  if (broadUnbackedClaim) {
    return {
      sufficient: false,
      reason: 'The transcript contains broad self-claims but no concrete project, tool-use, qualification, or work example to back them.',
    };
  }

  return {
    sufficient: true,
    reason: 'Applicant evidence is sufficient for a cautious first draft.',
  };
}

function buildInsufficientEvidenceArtifact(mode, candidateName, reason) {
  const displayName = candidateName || 'Candidate';

  if (mode === 'profile') {
    return {
      candidateProfileMarkdown: [
        `# Candidate Profile: ${displayName}`,
        '',
        '## Task Context',
        '',
        'A task-fit profile cannot be responsibly generated yet because the interview evidence is insufficient.',
        '',
        '## Fit Summary',
        '',
        `There is not enough applicant evidence to connect this candidate to the target task. ${reason}`,
        '',
        '## Relevant Strengths',
        '',
        '- No concrete strengths can be claimed yet from the current transcript.',
        '',
        '## Possible Contribution',
        '',
        'Ask follow-up questions before assigning a candidate role or contribution area.',
        '',
        '## Evidence From Interview',
        '',
        '- No usable applicant evidence was found in the transcript.',
        '',
        '## Gaps To Clarify',
        '',
        '- Completed projects, tools used, personal contribution, collaboration style, and task-relevant examples.',
        '',
        '## Suggested Follow-Up',
        '',
        '- Tell me about one completed project that is relevant to this task or opportunity.',
      ].join('\n'),
      profileCards: [
        {
          label: 'Candidate Evidence',
          evidenceStrength: 0,
          evidence: ['No usable applicant evidence was found in the transcript.'],
          gap: reason,
        },
        {
          label: 'Technical Skills',
          evidenceStrength: 0,
          evidence: ['The transcript does not support any technical skill claims yet.'],
          gap: 'Ask about completed projects, tools used, languages, frameworks, Git, debugging, and testing.',
        },
        {
          label: 'Project Evidence',
          evidenceStrength: 0,
          evidence: ['No project details are available from the applicant transcript.'],
          gap: 'Ask the applicant to describe one relevant project, their personal contribution, and the result.',
        },
        {
          label: 'Communication and Work Habits',
          evidenceStrength: 0,
          evidence: ['No applicant examples of communication, reliability, or collaboration are available.'],
          gap: 'Ask for examples involving deadlines, progress updates, blockers, teammates, or clients.',
        },
      ],
      feedbackMarkdown: [
        '## Insufficient Applicant Evidence',
        '',
        `A candidate profile cannot be responsibly generated yet. ${reason}`,
        '',
        'The next interview should collect concrete applicant answers before any strengths, fit, or gaps are treated as meaningful.',
      ].join('\n'),
      followUpQuestions: [
        'Tell me about one completed project that is relevant to this job.',
        'What did you personally build or implement in that project?',
        'Which languages, frameworks, or tools did you use?',
        'How did you use Git, testing, debugging, or validation in the project?',
        'Tell me about a bug, blocker, or deadline you handled.',
        'How did you communicate progress or problems to teammates, reviewers, or clients?',
      ],
    };
  }

  return {
    resumeMarkdown: buildInsufficientEvidenceMarkdown(displayName, reason),
  };
}

function buildInsufficientEvidenceMarkdown(displayName, reason) {
  return [
    `# ${displayName}`,
    '',
    '## Evidence Status',
    '',
    'An evidence-based resume draft cannot be generated yet.',
    '',
    `**Reason:** ${reason}`,
    '',
    '## What Is Missing',
    '',
    '- Applicant answers about completed projects.',
    '- Specific tools, languages, frameworks, or technologies used.',
    '- Personal contribution and responsibilities.',
    '- Evidence of Git, testing, debugging, or validation.',
    '- Communication, reliability, collaboration, or deadline examples.',
    '',
    '## Next Interview Questions',
    '',
    '- Tell me about one completed project that is relevant to this job.',
    '- What did you personally build or implement?',
    '- Which tools, languages, and frameworks did you use?',
    '- What problem did you solve, and how did you know it worked?',
    '- How did you communicate progress, blockers, or follow-up notes?',
    '',
    '## Draft Resume Bullets',
    '',
    'No resume bullets generated. Collect applicant evidence first.',
  ].join('\n');
}

function buildInsufficientEvidenceLatex(displayName, reason) {
  const name = escapeLatex(displayName);
  const safeReason = escapeLatex(reason);
  return [
    '\\documentclass[11pt]{article}',
    '\\usepackage[margin=0.75in]{geometry}',
    '\\usepackage{enumitem}',
    '\\usepackage[hidelinks]{hyperref}',
    '\\usepackage{titlesec}',
    '\\setlist[itemize]{leftmargin=*,noitemsep,topsep=2pt}',
    '\\titleformat{\\section}{\\large\\bfseries}{}{0pt}{}[\\titlerule]',
    '\\begin{document}',
    '\\begin{center}',
    `{\\LARGE\\textbf{${name}}}\\\\`,
    '\\vspace{4pt}',
    '\\textit{Evidence-gated resume draft}',
    '\\end{center}',
    '\\section*{Evidence Status}',
    'An evidence-based resume draft cannot be generated yet.',
    '',
    `\\textbf{Reason:} ${safeReason}`,
    '\\section*{What Is Missing}',
    '\\begin{itemize}',
    '\\item Applicant answers about completed projects.',
    '\\item Specific tools, languages, frameworks, or technologies used.',
    '\\item Personal contribution and responsibilities.',
    '\\item Evidence of Git, testing, debugging, or validation.',
    '\\item Communication, reliability, collaboration, or deadline examples.',
    '\\end{itemize}',
    '\\section*{Next Interview Questions}',
    '\\begin{itemize}',
    '\\item Tell me about one completed project that is relevant to this job.',
    '\\item What did you personally build or implement?',
    '\\item Which tools, languages, and frameworks did you use?',
    '\\item What problem did you solve, and how did you know it worked?',
    '\\item How did you communicate progress, blockers, or follow-up notes?',
    '\\end{itemize}',
    '\\section*{Draft Resume Bullets}',
    'No resume bullets generated. Collect applicant evidence first.',
    '\\end{document}',
  ].join('\n');
}

function addProvider(payload, provider) {
  payload.provider = provider;
  return payload;
}

async function formatTranscriptWithFallback(rawTranscript, applicantName) {
  const text = String(rawTranscript || '').trim();
  return conservativeFormatTranscript(text, applicantName);
}

function hasClearSpeakerLabels(text, applicantName) {
  const name = escapeRegExp(applicantName || 'Applicant');
  return (
    /\bInterviewer:\s+/i.test(text) &&
    (new RegExp(`\\b${name}:\\s+`, 'i').test(text) || /\bApplicant:\s+/i.test(text))
  );
}

function buildTranscriptFormatPrompt(transcript, applicantName) {
  return [
    'Format this interview transcript into clear speaker turns.',
    'Do not summarize, rewrite, polish, add facts, remove facts, or change the wording except for punctuation and speaker labels.',
    'Label interviewer questions or prompts as "Interviewer:".',
    `Label applicant answers as "${applicantName}:".`,
    'Put one blank line between speaker turns.',
    'If a boundary is uncertain, infer conservatively from question/answer structure.',
    'Return only the formatted transcript.',
    '',
    `TRANSCRIPT:\n${transcript}`,
  ].join('\n');
}

function conservativeFormatTranscript(transcript, applicantName) {
  const text = String(transcript || '').trim();
  if (!text) {
    return text;
  }

  const applicantLabel = applicantName || 'Applicant';
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const formatted = lines.flatMap((line) => {
    const match = line.match(/^([^:]{1,50}):\s*(.+)$/);
    if (!match) {
      return splitUnlabelledTranscriptLine(line, applicantLabel);
    }

    const label = match[1].trim();
    const body = match[2].trim();
    if (/^(recruiter|interviewer)$/i.test(label)) {
      return `Interviewer: ${body}`;
    }
    if (/^(applicant|candidate|student)$/i.test(label)) {
      return `${applicantLabel}: ${body}`;
    }
    return `${label}: ${body}`;
  });

  return formatted.join('\n\n');
}

function splitUnlabelledTranscriptLine(line, applicantLabel) {
  const parts = splitIntoSentences(line);
  if (parts.length <= 1 || !parts.some((part) => part.endsWith('?'))) {
    return [line];
  }

  const turns = [];
  let currentSpeaker = '';
  let currentText = [];

  const flush = () => {
    if (!currentSpeaker || currentText.length === 0) {
      return;
    }
    turns.push(`${currentSpeaker}: ${currentText.join(' ').trim()}`);
    currentSpeaker = '';
    currentText = [];
  };

  parts.forEach((part) => {
    const speaker = part.endsWith('?') ? 'Interviewer' : applicantLabel;
    if (currentSpeaker && currentSpeaker !== speaker) {
      flush();
    }
    currentSpeaker = speaker;
    currentText.push(part);
  });

  flush();
  return turns.length ? turns : [line];
}

function splitIntoSentences(text) {
  const matches = String(text || '').match(/[^.!?]+[.!?]+(?:["')\]]+)?|[^.!?]+$/g);
  return (matches || [])
    .map((part) => part.trim())
    .filter(Boolean);
}

function validateArtifacts(payload, providerName, mode) {
  if (!payload) {
    throw new Error(`${providerName} returned no JSON artifact.`);
  }
  if (mode === 'resume') {
    if (!payload.resumeMarkdown && !payload.resumeLatex) {
      throw new Error(`${providerName} did not return resumeMarkdown.`);
    }
    if (!payload.resumeMarkdown && payload.resumeLatex) {
      payload.resumeMarkdown = payload.resumeLatex;
    }
    return payload;
  }

  if (mode === 'profile') {
    if (!payload.candidateProfileMarkdown) {
      payload.candidateProfileMarkdown = buildCandidateProfileMarkdownFromCards(payload.profileCards || [], payload.feedbackMarkdown || '');
    }
    if (!Array.isArray(payload.profileCards) || payload.profileCards.length === 0) {
      throw new Error(`${providerName} did not return profileCards.`);
    }
    if (!payload.feedbackMarkdown) {
      throw new Error(`${providerName} did not return feedbackMarkdown.`);
    }
    if (!Array.isArray(payload.followUpQuestions) || payload.followUpQuestions.length === 0) {
      throw new Error(`${providerName} did not return followUpQuestions.`);
    }
    return payload;
  }

  if (!payload.resumeMarkdown && !payload.resumeLatex) {
    throw new Error(`${providerName} did not return resumeMarkdown.`);
  }
  if (!payload.resumeMarkdown && payload.resumeLatex) {
    payload.resumeMarkdown = payload.resumeLatex;
  }
  if (!Array.isArray(payload.profileCards) || payload.profileCards.length === 0) {
    throw new Error(`${providerName} did not return profileCards.`);
  }
  if (!payload.feedbackMarkdown) {
    throw new Error(`${providerName} did not return feedbackMarkdown.`);
  }
  if (!Array.isArray(payload.followUpQuestions) || payload.followUpQuestions.length === 0) {
    throw new Error(`${providerName} did not return followUpQuestions.`);
  }
  return payload;
}

function buildCandidateProfileMarkdownFromCards(cards, feedbackMarkdown) {
  const safeCards = Array.isArray(cards) ? cards : [];
  if (!safeCards.length && !feedbackMarkdown) {
    return '';
  }

  const strongest = [...safeCards]
    .sort((a, b) => Number(b.evidenceStrength || 0) - Number(a.evidenceStrength || 0))
    .slice(0, 3);
  const gaps = safeCards
    .map((card) => String(card.gap || '').trim())
    .filter(Boolean);

  return [
    '# Candidate Profile',
    '',
    '## Task Context',
    '',
    'Review this profile against the task or opportunity description provided above.',
    '',
    '## Fit Summary',
    '',
    feedbackMarkdown || 'The profile is based on the available interview evidence and should be reviewed before use.',
    '',
    '## Relevant Strengths',
    '',
    ...(strongest.length
      ? strongest.map((card) => `- **${card.label || 'Evidence area'}:** ${(card.evidence || [])[0] || 'Review supporting evidence.'}`)
      : ['- Add more interview evidence before identifying relevant strengths.']),
    '',
    '## Evidence From Interview',
    '',
    ...safeCards.flatMap((card) => [
      `### ${card.label || 'Evidence Area'}`,
      '',
      ...((card.evidence || []).length ? card.evidence.map((item) => `- ${item}`) : ['- No concrete evidence captured yet.']),
      '',
    ]),
    '## Gaps To Clarify',
    '',
    ...(gaps.length ? gaps.map((gap) => `- ${gap}`) : ['- Clarify task-relevant examples before relying on this profile.']),
  ].join('\n');
}

async function transcribeWithGemini(apiKey, prompt, audioData, mimeType) {
  const payload = {
    model: process.env.GEMINI_TRANSCRIBE_MODEL || 'gemini-3.5-flash',
    input: [
      { type: 'text', text: prompt },
      { type: 'audio', data: audioData, mime_type: mimeType },
    ],
  };

  const response = await postGemini(apiKey, payload);
  const transcript = extractOutputText(response);
  if (!transcript) {
    throw new Error('Gemini returned no transcript text.');
  }
  return transcript;
}

async function generateArtifactsWithGemini(apiKey, prompt, mode) {
  const payload = {
    model: process.env.GEMINI_TEXT_MODEL || 'gemini-3.5-flash',
    input: [{ type: 'text', text: prompt }],
  };

  const response = await postGemini(apiKey, payload);
  const outputText = extractOutputText(response);
  const parsed = parseJsonOutput(outputText);
  return validateArtifacts(parsed, 'Gemini', mode);
}

async function transcribeWithOpenAI(apiKey, prompt, audioData, mimeType, fileName) {
  const audioBuffer = Buffer.from(audioData, 'base64');
  const model = process.env.OPENAI_TRANSCRIBE_MODEL || 'gpt-4o-mini-transcribe';
  const fields = [
    { name: 'model', value: model },
    { name: 'response_format', value: 'json' },
    { name: 'prompt', value: prompt },
    {
      name: 'file',
      fileName: normalizeUploadFileName(fileName, mimeType),
      contentType: normalizeOpenAiMimeType(mimeType),
      value: audioBuffer,
    },
  ];

  const response = await postOpenAiMultipart(apiKey, '/v1/audio/transcriptions', fields);
  const transcript = response && response.text ? String(response.text).trim() : '';
  if (!transcript) {
    throw new Error('OpenAI returned no transcript text.');
  }
  return transcript;
}

async function generateArtifactsWithOpenAI(apiKey, prompt, mode) {
  const payload = {
    model: process.env.OPENAI_TEXT_MODEL || 'gpt-4o-mini',
    input: prompt,
  };

  const response = await postOpenAiJson(apiKey, '/v1/responses', payload);
  const outputText = extractOutputText(response);
  const parsed = parseJsonOutput(outputText);
  return validateArtifacts(parsed, 'OpenAI', mode);
}

function fetchPageText(url, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    if (redirectCount > 5) {
      reject(new Error('Too many redirects.'));
      return;
    }

    const parsedUrl = new URL(url);
    const transport = parsedUrl.protocol === 'http:' ? http : https;
    const req = transport.request(
      {
        protocol: parsedUrl.protocol,
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || undefined,
        path: `${parsedUrl.pathname}${parsedUrl.search}`,
        method: 'GET',
        timeout: 12000,
        headers: {
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.5',
          'Accept-Language': 'en-SG,en;q=0.9',
          'User-Agent': 'collaborative-resume-builder/0.1 job-url-import',
        },
      },
      (res) => {
        const statusCode = res.statusCode || 0;
        const location = res.headers.location;

        if ([301, 302, 303, 307, 308].includes(statusCode) && location) {
          res.resume();
          const nextUrl = new URL(location, parsedUrl).toString();
          fetchPageText(nextUrl, redirectCount + 1).then(resolve, reject);
          return;
        }

        if ([401, 403, 429].includes(statusCode)) {
          res.resume();
          resolve({ text: '', restricted: true });
          return;
        }

        if (statusCode < 200 || statusCode >= 300) {
          res.resume();
          reject(new Error(`Page request failed with ${statusCode}.`));
          return;
        }

        const chunks = [];
        let size = 0;
        res.on('data', (chunk) => {
          size += chunk.length;
          if (size > 1_500_000) {
            req.destroy(new Error('Page is too large to import.'));
            return;
          }
          chunks.push(chunk);
        });
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          const text = htmlToReadableText(raw);
          resolve({
            text,
            restricted: looksLikeRestrictedPage(raw, text),
          });
        });
      },
    );

    req.on('timeout', () => req.destroy(new Error('Page request timed out.')));
    req.on('error', reject);
    req.end();
  });
}

function htmlToReadableText(html) {
  return decodeHtmlEntities(String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<\/(p|div|section|article|li|dt|dd|h[1-6]|tr)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim())
    .split(/\n|\s{2,}/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n')
    .slice(0, 30000);
}

function decodeHtmlEntities(value) {
  return String(value || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#(\d+);/g, (_match, code) => {
      const parsed = Number(code);
      return Number.isFinite(parsed) ? String.fromCharCode(parsed) : '';
    });
}

function looksLikeRestrictedPage(rawHtml, readableText) {
  const combined = `${rawHtml}\n${readableText}`.toLowerCase();
  return [
    'captcha',
    'access denied',
    'unusual traffic',
    'verify you are human',
    'enable javascript',
    'bot detection',
    'blocked by',
    'akamai',
    'cloudflare',
  ].some((term) => combined.includes(term));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];

    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > maxBodyBytes) {
        reject(new Error('Audio upload is too large for V2A inline transcription.'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
      } catch (error) {
        reject(new Error('Invalid JSON request body.'));
      }
    });

    req.on('error', reject);
  });
}

function postGemini(apiKey, payload) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const req = https.request(
      {
        hostname: 'generativelanguage.googleapis.com',
        path: '/v1beta/interactions',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
          'x-goog-api-key': apiKey,
        },
      },
      (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          let parsed;
          try {
            parsed = JSON.parse(raw || '{}');
          } catch (error) {
            reject(new Error(`Gemini returned a non-JSON response: ${raw.slice(0, 200)}`));
            return;
          }

          if (res.statusCode < 200 || res.statusCode >= 300) {
            const message = parsed.error && parsed.error.message
              ? parsed.error.message
              : `Gemini request failed with ${res.statusCode}.`;
            reject(new Error(message));
            return;
          }

          resolve(parsed);
        });
      },
    );

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function postOpenAiJson(apiKey, pathname, payload) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const req = https.request(
      {
        hostname: 'api.openai.com',
        path: pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
          Authorization: `Bearer ${apiKey}`,
        },
      },
      (res) => collectJsonResponse(res, 'OpenAI', resolve, reject),
    );

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function postOpenAiMultipart(apiKey, pathname, fields) {
  return new Promise((resolve, reject) => {
    const boundary = `----collabResume${Date.now().toString(16)}`;
    const body = buildMultipartBody(boundary, fields);
    const req = https.request(
      {
        hostname: 'api.openai.com',
        path: pathname,
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': body.length,
          Authorization: `Bearer ${apiKey}`,
        },
      },
      (res) => collectJsonResponse(res, 'OpenAI', resolve, reject),
    );

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function buildMultipartBody(boundary, fields) {
  const chunks = [];
  fields.forEach((field) => {
    chunks.push(Buffer.from(`--${boundary}\r\n`));
    if (field.fileName) {
      chunks.push(Buffer.from(
        `Content-Disposition: form-data; name="${field.name}"; filename="${field.fileName}"\r\n` +
        `Content-Type: ${field.contentType || 'application/octet-stream'}\r\n\r\n`,
      ));
      chunks.push(Buffer.isBuffer(field.value) ? field.value : Buffer.from(String(field.value)));
      chunks.push(Buffer.from('\r\n'));
      return;
    }

    chunks.push(Buffer.from(
      `Content-Disposition: form-data; name="${field.name}"\r\n\r\n${field.value}\r\n`,
    ));
  });
  chunks.push(Buffer.from(`--${boundary}--\r\n`));
  return Buffer.concat(chunks);
}

function collectJsonResponse(res, providerName, resolve, reject) {
  const chunks = [];
  res.on('data', (chunk) => chunks.push(chunk));
  res.on('end', () => {
    const raw = Buffer.concat(chunks).toString('utf8');
    let parsed;
    try {
      parsed = JSON.parse(raw || '{}');
    } catch (error) {
      reject(new Error(`${providerName} returned a non-JSON response: ${raw.slice(0, 200)}`));
      return;
    }

    if (res.statusCode < 200 || res.statusCode >= 300) {
      const message = parsed.error && parsed.error.message
        ? parsed.error.message
        : `${providerName} request failed with ${res.statusCode}.`;
      reject(new Error(message));
      return;
    }

    resolve(parsed);
  });
}

function normalizeOpenAiMimeType(mimeType) {
  return String(mimeType || 'audio/webm').toLowerCase().split(';')[0].trim() || 'audio/webm';
}

function normalizeUploadFileName(fileName, mimeType) {
  const safeName = String(fileName || 'interview-audio')
    .replace(/[^\w.\-]+/g, '_')
    .replace(/^_+|_+$/g, '');

  if (/\.(flac|mp3|mp4|mpeg|mpga|m4a|ogg|wav|webm)$/i.test(safeName)) {
    return safeName;
  }

  const normalizedMimeType = normalizeOpenAiMimeType(mimeType);
  if (normalizedMimeType.includes('ogg')) return `${safeName}.ogg`;
  if (normalizedMimeType.includes('wav')) return `${safeName}.wav`;
  if (normalizedMimeType.includes('mpeg')) return `${safeName}.mp3`;
  if (normalizedMimeType.includes('mp4')) return `${safeName}.m4a`;
  return `${safeName}.webm`;
}

function extractOutputText(response) {
  if (typeof response.output_text === 'string') {
    return response.output_text.trim();
  }

  if (Array.isArray(response.output)) {
    return response.output
      .flatMap((item) => item.content || [])
      .map((part) => {
        if (typeof part.text === 'string') return part.text;
        if (typeof part.output_text === 'string') return part.output_text;
        return '';
      })
      .filter(Boolean)
      .join('\n')
      .trim();
  }

  const stepText = Array.isArray(response.steps)
    ? response.steps
        .flatMap((step) => step.content || [])
        .filter((part) => part.type === 'text' && typeof part.text === 'string')
        .map((part) => part.text)
        .join('\n')
        .trim()
    : '';

  return stepText;
}

function parseJsonOutput(value) {
  const text = String(value || '').trim();
  if (!text) {
    return null;
  }

  const withoutFence = text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```$/i, '')
    .trim();

  try {
    return JSON.parse(withoutFence);
  } catch (error) {
    const start = withoutFence.indexOf('{');
    const end = withoutFence.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) {
      return null;
    }

    try {
      return JSON.parse(withoutFence.slice(start, end + 1));
    } catch (innerError) {
      return null;
    }
  }
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapeLatex(value) {
  return String(value || '')
    .replace(/\\/g, '\\textbackslash{}')
    .replace(/&/g, '\\&')
    .replace(/%/g, '\\%')
    .replace(/\$/g, '\\$')
    .replace(/#/g, '\\#')
    .replace(/_/g, '\\_')
    .replace(/{/g, '\\{')
    .replace(/}/g, '\\}')
    .replace(/~/g, '\\textasciitilde{}')
    .replace(/\^/g, '\\textasciicircum{}');
}

function serveStatic(pathname, res) {
  const cleanPath = decodeURIComponent(pathname).replace(/^\/+/, '');
  const requestedPath = path.normalize(path.join(distDir, cleanPath || 'index.html'));
  const filePath = requestedPath.startsWith(distDir) && fs.existsSync(requestedPath)
    ? requestedPath
    : path.join(distDir, 'index.html');

  fs.readFile(filePath, (error, content) => {
    if (error) {
      sendJson(res, 404, { error: 'Build output not found. Run npm run build first.' });
      return;
    }

    res.writeHead(200, { 'Content-Type': contentType(filePath) });
    res.end(content);
  });
}

function sendJson(res, status, payload) {
  const data = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data),
  });
  res.end(data);
}

function contentType(filePath) {
  const extension = path.extname(filePath);
  if (extension === '.html') return 'text/html; charset=utf-8';
  if (extension === '.js') return 'application/javascript; charset=utf-8';
  if (extension === '.css') return 'text/css; charset=utf-8';
  if (extension === '.svg') return 'image/svg+xml';
  if (extension === '.json') return 'application/json; charset=utf-8';
  return 'application/octet-stream';
}

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      return;
    }

    const equalsIndex = trimmed.indexOf('=');
    if (equalsIndex === -1) {
      return;
    }

    const key = trimmed.slice(0, equalsIndex).trim();
    const value = trimmed.slice(equalsIndex + 1).trim().replace(/^['"]|['"]$/g, '');
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  });
}
