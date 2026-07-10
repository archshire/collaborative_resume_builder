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
      ? 'Skill profile generation failed for all configured providers.'
      : 'Resume generation failed for all configured providers.',
    details: errors,
  });
}

function buildArtifactPrompt(mode, candidateName, target, transcript, existingResume) {
  const common = [
    'You are an evidence-based resume assistant for a 42 student.',
    'Use the TRANSCRIPT as the only source for candidate claims.',
    'If an EXISTING RESUME DRAFT is provided, use it as the previous draft to revise, not as independent evidence.',
    'Use the TARGET JOB/TASK only to evaluate fit and identify missing evidence.',
    'Do not invent skills, tools, experience, dates, achievements, or project details.',
    'Do not convert target job requirements into candidate skills unless the transcript explicitly supports them.',
    'Do not treat interviewer questions as candidate evidence.',
    'Distinguish unsupported claims from backed evidence. A claim like "I am good at JavaScript" is not enough unless the transcript also gives a project, tool use, task, duration, result, qualification, or concrete example.',
    'Do not treat irrelevant, joking, absurd, sexual, manipulative, or non-work-related statements as evidence of job skill.',
    'If the transcript contains broad boasts such as being good at all languages without concrete examples, put them in missing evidence or feedback instead of resume skills.',
    'If the transcript contains only test text, interviewer prompts, or too little applicant evidence, say there is insufficient evidence instead of drafting a resume.',
    'If a required job skill is not evidenced in the transcript, put it in gaps and ask a follow-up question.',
    'Return valid JSON only. Do not wrap it in markdown fences.',
  ];

  const modeSpecific = mode === 'profile'
    ? [
        'Generate only the skill profile and interview feedback artifacts.',
        'Schema:',
        '{',
        '  "profileCards": [{"label":"string","evidenceStrength":0,"evidence":["string"],"gap":"string"}],',
        '  "feedbackMarkdown": "string",',
        '  "followUpQuestions": ["string"]',
        '}',
        'profileCards must contain 4 to 6 cards. Each card must include label, evidenceStrength, evidence, and gap.',
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
        'Resume format must use these sections: Candidate Name, Target Fit Summary, Evidence-Based Skills, Project Evidence, Communication Evidence, Missing Evidence To Collect, Draft Resume Bullets.',
        'If the transcript contains initial and follow-up sections, combine both into one stronger updated resume.',
        'If an existing resume draft is provided, preserve useful supported structure and improve it with new follow-up evidence.',
        'Write concise resume-ready bullets, but mark uncertain or missing claims as missing evidence instead of pretending they are proven.',
        'Do not include profileCards, feedbackMarkdown, or followUpQuestions.',
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
        `A skill profile cannot be responsibly generated yet. ${reason}`,
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
    resumeMarkdown: [
      `# ${displayName}`,
      '',
      '## Evidence Status',
      '',
      'An evidence-based resume draft cannot be generated yet.',
      '',
      `Reason: ${reason}`,
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
    ].join('\n'),
  };
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
    if (!payload.resumeMarkdown) {
      throw new Error(`${providerName} did not return resumeMarkdown.`);
    }
    return payload;
  }

  if (mode === 'profile') {
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

  if (!payload.resumeMarkdown) {
    throw new Error(`${providerName} did not return resumeMarkdown.`);
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
