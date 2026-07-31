# Current Build Sensemaking

## Current Product Direction

This branch reframes the app from a 42 collaborative resume exercise helper into a regular job seeker resume builder.

The visible product now uses a simulated single-user login and a six-step guided workflow:

1. Context Setting
2. Applicant Information
3. Part 1 - Initial Interview
4. Generate Resume / Skill Profile / Candidate Profile
5. Part 2 - Interview Feedback and Follow-up Questions
6. Generate Full Resume

The important architectural shift is that the app is no longer understood as a direct resume generator. It is now better understood as an evidence builder.

```text
Job description
Applicant information
Interview answers
Follow-up answers
        |
        v
Structured Evidence Engine
        |
        v
Resume / Skill Profile / Candidate Profile / Follow-up Questions / Evidence Used
```

## Why The Shift Happened

The earlier product shape moved quickly from interview transcript to resume output. That was useful as a prototype, but it carried a major risk: AI can turn weak, vague, or irrelevant text into resume claims that look polished but are not well supported.

The builder wanted a tool for real job seekers, so the app needed a stronger source-of-truth layer. The key question became:

```text
What evidence do we actually have for this candidate, and how does it relate to the job?
```

That led to the evidence-engine architecture.

## Current Architecture In Plain Terms

### Step 1: Parse The Job

The app collects job context through:

- a pasted job link;
- a text/document upload;
- an image or screenshot upload;
- manual company, role, and job-description fields.

The backend can use AI vision/OCR for image uploads. If the uploaded image is not a job description, it is discarded as `not_job`.

The app extracts or derives:

- responsibilities;
- requirements;
- qualifications;
- keywords;
- competencies.

### Step 2: Collect Candidate Data

Candidate data comes from:

- applicant information fields;
- highest qualification;
- additional qualifications with month/year;
- initial interview transcript;
- per-question text answers;
- follow-up transcript;
- per-follow-up-question text answers.

### Step 3: Build Evidence Objects

The frontend converts candidate information into structured evidence objects.

Each evidence object contains:

```json
{
  "id": "ev_abc123",
  "competency": "Technical execution",
  "supportingQuote": "Built a dashboard using React...",
  "source": "initial_interview",
  "confidence": 0.82,
  "quantifiedValues": ["3", "weekly"],
  "relatedJob": "Build and maintain front-end dashboards"
}
```

This is the main source-of-truth layer for later generation.

### Step 4: Classify Evidence Strength

The app compares job requirements against available evidence and classifies each requirement as:

- High Evidence
- Medium Evidence
- Weak Evidence
- Missing

This classification powers the evidence review, follow-up questions, and final resume readiness check.

### Step 5: Ask Better Follow-up Questions

Follow-up questions are no longer generic. They target only weak or missing competencies.

If a competency already has high evidence, the app should avoid asking about it again.

### Step 6: Generate Final Resume From Evidence

The final resume is generated only after the evidence graph is rebuilt with follow-up answers included.

The backend prompt treats the structured evidence graph as authoritative. Raw transcripts and text answers are secondary context.

The generator is instructed to:

- use high/medium evidence for strong resume claims;
- omit missing requirements as candidate claims;
- avoid target-job skills that are not supported by evidence;
- prefer quantified values when available;
- never invent numbers, tools, roles, dates, or achievements.

## Evidence Review

Tab 4 now includes a Structured Evidence Review.

It shows evidence cards with:

- competency;
- confidence;
- source;
- supporting quote;
- related job requirement;
- quantified values.

Filters:

- All
- High/Medium
- Weak
- Ignored

The user can ignore evidence. Ignored evidence is excluded from active competency classification and final resume generation during the browser session.

## Final Resume Traceability

Phase 6 added resume bullet traceability.

The backend is asked to return:

```json
{
  "resumeMarkdown": "...",
  "resumeEvidenceMap": [
    {
      "resumeBullet": "Built a customer dashboard using React...",
      "evidenceIds": ["ev_abc123"],
      "competency": "Technical execution",
      "source": "initial_interview",
      "confidence": 0.82
    }
  ]
}
```

Tab 6 shows an Evidence Used section under the final resume.

Each resume bullet can be inspected against the evidence that supports it. If a bullet is not mapped, it is flagged as needing review.

## Resume Format Direction

The recommended output format is a targeted hybrid ATS resume:

```text
NAME
Email | Phone | Location
LinkedIn | Portfolio/GitHub

PROFESSIONAL SUMMARY
2-3 evidence-backed lines targeted to the job.

CORE SKILLS
Grouped skills supported by evidence.

RELEVANT EXPERIENCE
Role / Project / Organization | Dates
- Evidence-backed bullet
- Evidence-backed bullet

SELECTED PROJECTS
Only if project evidence is stronger than work history.

EDUCATION
Highest qualification first.

CERTIFICATIONS
Supported certifications only.

ADDITIONAL INFORMATION
Languages, awards, availability, or other relevant details.
```

The export should remain ATS-friendly:

- no tables;
- no icons;
- no multi-column layout;
- no decorative graphics;
- plain headings;
- concise evidence-backed bullets.

## Current Technical Reality

The app still uses a simple architecture:

- Vite + TypeScript frontend;
- Node `http` backend;
- no database;
- simulated login only;
- `.env` for AI provider keys;
- Gemini/OpenAI for transcription and generation;
- browser session storage for temporary state.

This is enough for the current prototype because the goal is to prove the evidence workflow before adding accounts, persistence, or cloud deployment.

## Why This Build Is Different

Most AI resume builders go directly from user input to generated resume.

This build inserts a reviewable evidence layer in the middle.

That makes the resume only one possible output. The same evidence graph can later support:

- cover letters;
- LinkedIn profile summaries;
- interview preparation;
- candidate profiles;
- portfolio summaries;
- job-fit diagnostics.

The product insight is:

```text
The resume is the output.
The evidence graph is the product.
```

## Current Risk Register

- Evidence extraction is still heuristic in the frontend.
- AI-generated `resumeEvidenceMap` still needs real-world testing.
- No database means evidence review decisions are session-only.
- Resume formatting is not yet tuned across different job seeker types.
- Provider behavior depends on API keys, model support, quota, and audio MIME compatibility.

## Suggested Next Build Focus

1. Test the evidence engine with several real job descriptions.
2. Compare generated follow-up questions against the actual weak/missing classifications.
3. Tune the final resume format for fresh graduates, career switchers, and experienced candidates.
4. Decide whether evidence objects should be persisted in SQLite before Railway deployment.
5. Add automated smoke tests for `/api/generate-artifacts` and `/api/transcribe` request validation.
