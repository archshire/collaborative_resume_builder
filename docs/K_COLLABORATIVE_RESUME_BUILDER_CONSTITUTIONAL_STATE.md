# K_COLLABORATIVE_RESUME_BUILDER_CONSTITUTIONAL_STATE

## Process Documentation Note

The end product has evolved significantly in both capability and name. The project began as `earfully_resume`, a listening-oriented resume assistant, and evolved into `collaborative_resume_builder`, a two-part AI-assisted tool for the 42 `collaborative_resume` project.

This state document is process documentation. It intentionally preserves earlier assumptions, superseded decisions, staged reasoning, and naming evolution so reviewers and future AI collaborators can see the build journey rather than only the final artifact. Later locked truths supersede earlier entries where the product has evolved.

## Table of Contents

- [Process Documentation Note](#process-documentation-note)
- [Document Metadata](#document-metadata)
- [KRYSTALIZE Session Start Summary](#krystalize-session-start-summary)
- [Project Intent](#project-intent)
- [Core Philosophy](#core-philosophy)
- [Locked Truths](#locked-truths)
- [Established Knowledge](#established-knowledge)
- [Dependency Map](#dependency-map)
- [Unresolved Issues](#unresolved-issues)
- [Accepted Uncertainty](#accepted-uncertainty)
- [Warning Registry](#warning-registry)
- [Clarification Frontier](#clarification-frontier)
- [Suggested Next Reasoning Focus](#suggested-next-reasoning-focus)

## Document Metadata

```yaml
artifact_type: constitutional_state
protocol: KRYSTALIZE
protocol_version: 1
session_id: KRYS-collaborative_resume_builder-001
project_name: collaborative_resume_builder
created_at: 2026-07-08
updated_at: 2026-07-10
status: draft
```

## KRYSTALIZE Session Start Summary

The builder began with the intent to build the first individual-use Project Listen application: a resume interview assistant.

The initial desire was for a student to launch an app, capture interview speech, transcribe it, generate a professional resume, and optionally generate a visual evidence-backed skill profile.

The conversation explored whether existing tools could be wired together instead of building every layer from scratch. Microsoft Word Transcribe was rejected as a required dependency because the builder wants a solution that does not depend on Word. Google/Gemini, Google Docs, Google Drive, Whisper, and direct ChatGPT/Gemini workflows were considered.

The stabilized direction is staged:

```text
V1
Web app
-> record audio in 10-minute chunks
-> let user download/save recordings
-> let user drag/drop recordings back in
-> provide transcript box
-> generate resume draft from transcript
-> generate evidence-backed skill profile visual from transcript

V1 transcription path
Audio chunk
-> Gemini app/API/manual transcription
-> paste transcript into app

V2
Gemini API transcription
-> Google login
-> save audio/transcript/resume to Drive
-> open generated resume as Google Doc
```

This preserves the desired final product direction while avoiding early blockage on Google OAuth, Drive API, Docs API, transcription billing, and API-key setup.

The current implementation has advanced beyond the original V1 boundary. The app now includes a local backend for automated transcription and generation, tries Gemini first with OpenAI fallback where configured, and structures the user journey into two phases:

```text
Part 1 - Initial Interview
-> record an interview
-> transcribe audio
-> generate initial resume/profile/feedback

Part 2 - Follow-up questions
-> ask follow-up questions from the feedback layer
-> record follow-up audio
-> transcribe follow-up audio
-> re-generate resume and skill profile from the combined evidence
```

## Project Intent

collaborative_resume_builder is an individual-use AI-assisted application that helps a student convert an interview conversation into a professional resume draft and evidence-backed skill profile.

The project-facing name intentionally points to the 42 collaborative resume project. Its current product description is:

```text
A tool to help 42 students in Circle 6 enjoy the project without multitasking.
```

The application should demonstrate responsible AI-assisted development while preserving human interview evidence as the source of truth.

## Core Philosophy

- Human conversation remains primary.
- AI output must be reviewable.
- Resume claims should be traceable to transcript evidence.
- Automation should be staged after the workflow is understood.
- The project should remain a reusable vertical slice of the broader Project Listen platform.

## Locked Truths

| ID | Locked Truth | Source | Date Locked | Notes |
| --- | --- | --- | --- | --- |
| LT-001 | The app now named `collaborative_resume_builder` is the first individual-use project. | Builder clarification | 2026-07-08 | Build starts with the resume interview assistant; the original working name was Earfully Resume. |
| LT-002 | The MVP should not depend on Microsoft Word. | Builder clarification | 2026-07-08 | The app should avoid Word Transcribe as a required layer. |
| LT-003 | The first build may use manual transcript paste before automated transcription. | Builder/Codex clarification | 2026-07-08 | This reduces setup risk while proving the workflow. |
| LT-004 | Automated transcription remains a planned later stage. | Builder/Codex clarification | 2026-07-08 | A future button should transcribe audio without pasting. |
| LT-005 | The v1 product surface includes audio chunk recording, drag/drop recordings, transcript input, resume generation, and skill-profile visualization. | Builder confirmation | 2026-07-08 | This is the first build target. |
| LT-006 | Google login, Drive storage, Docs output, and automatic transcription belong to a later stage. | Builder/Codex clarification | 2026-07-08 | Deferred to keep v1 buildable. |
| LT-007 | V1 should validate product value before V2 automates infrastructure. | Builder/Codex clarification | 2026-07-08 | V1 answers whether the transcript-to-resume/profile loop works; V2 answers whether it can be automated smoothly. |
| LT-008 | V1 will be implemented as a local browser app with no backend. | Builder/Codex clarification | 2026-07-08 | Use Vite + plain TypeScript where possible; no login, database, or external API required for v1. |
| LT-009 | V1 transcription is manual for now; the app does not yet perform automated audio-to-text transcription. | Builder clarification | 2026-07-08 | The Transcribe control is a manual bridge to Gemini or another transcription tool, followed by transcript paste back into the app. |
| LT-010 | Early V1 skill profile percentages represented heuristic transcript evidence strength, not true candidate ability scores. | Builder/Codex clarification | 2026-07-08 | Superseded for the current Gemini-backed path by LT-015; preserved as historical rationale for why the UI labels values as evidence strength. |
| LT-011 | V1 should include candidate and target job/task context so resume and profile output can speak to role fit. | Builder/Codex clarification | 2026-07-08 | This keeps the product aligned with the north star emphasis on strengths, interests, task fit, and deficiencies. |
| LT-012 | V1 should export generated artifacts locally, but should not include separate save/load session controls. | Builder clarification | 2026-07-08 | Audio files, transcript text, resume download, and skill-profile download are sufficient for the current V1 surface. |
| LT-013 | V2A adds Gemini API transcription through a local backend before Google login, Drive, or Docs automation. | Builder confirmation | 2026-07-08 | The API key remains server-side in `.env`; uploaded audio is sent to `/api/transcribe`, then transcript text returns to the transcript box. |
| LT-014 | Resume/profile generation must be evidence-governed and include missing-evidence feedback. | Builder correction | 2026-07-08 | The previous keyword heuristic produced incoherent output; Gemini now generates structured resume, profile, and follow-up questions from transcript evidence. |
| LT-015 | Skill profile evidence strength is model-assigned guidance, not a formal score. | Builder/Codex clarification | 2026-07-08 | Gemini returns `evidenceStrength` based on transcript support relative to the target task; it should guide follow-up questions, not act as a validated assessment. |
| LT-016 | The project-facing name is `collaborative_resume_builder`. | Builder clarification | 2026-07-08 | The name foregrounds the 42 collaborative resume project; "Builder" makes the tool purpose clear. |
| LT-017 | The current product flow is split into Part 1 initial interview and Part 2 follow-up questions. | Builder clarification | 2026-07-10 | This mirrors the interview-feedback-interview loop required to fill missing resume evidence. |
| LT-018 | Part 2 should not ask for recruiter/applicant names again. | Builder clarification | 2026-07-10 | Applicant identity from Part 1 carries into follow-up recording and file naming. |
| LT-019 | Follow-up recording must be explicitly armed before recording. | Builder clarification | 2026-07-10 | If the user clicks record before the ready control, the app should tell them to click ready first. |
| LT-020 | Follow-up audio files should be named `(applicant name)_follow_up.ogg` where the browser records OGG. | Builder clarification | 2026-07-10 | Multiple follow-up chunks may append an index. |
| LT-021 | The updated Part 2 resume is the PDF export point. | Builder clarification | 2026-07-10 | The first resume is an interim artifact; the final PDF should come after follow-up evidence is incorporated. |
| LT-022 | The README must satisfy the B1 Builders Programme expectations. | Builder request / B1 Builders Programme PDF | 2026-07-10 | It should explain problem, outcome, demo, stack, AI collaboration, installation, usage, structure, and reflection. |
| LT-023 | The canonical project directory, package name, and constitutional artifact names use `collaborative_resume_builder`. | Builder clarification | 2026-07-10 | This completes the move away from the early `earfully_resume` working name and aligns file identity with the 42 project being supported. |
| LT-024 | The technical stack and runtime flow should be explained in `docs/TECHNICAL_BUILD.md`. | Builder request | 2026-07-10 | Product docs explain why the app exists; this document explains how browser, backend, audio APIs, AI providers, and export flow work together. |
| LT-025 | Resume/profile generation must be blocked when the transcript lacks applicant evidence. | Builder correction | 2026-07-10 | A test-only transcript caused generic resume hallucination; the backend now returns an insufficient-evidence artifact before calling AI providers. |
| LT-026 | Transcription formatting must not invent interviewer questions. | Builder correction | 2026-07-10 | Speaker labels are normalized only when already present; the app no longer asks an AI formatter to infer missing interviewer questions from applicant replies. |
| LT-027 | Candidate claims are not automatically evidence. | Builder correction | 2026-07-10 | Broad, absurd, irrelevant, or unbacked claims are blocked or treated as missing evidence rather than converted into resume bullets. |

## Established Knowledge

| ID | Established Knowledge | Why It Exists | Impact Area | Source / Trace Link | Status |
| --- | --- | --- | --- | --- | --- |
| EK-001 | The product should be staged from workflow proof to automation. | Authentication, transcription APIs, and document automation introduce avoidable early complexity. | Architecture, roadmap | HC-003 | active |
| EK-002 | Evidence-backed skill visualization should be rendered from structured profile data, not merely generated as decorative imagery. | Reviewers and users need to see how strengths and gaps connect to interview evidence. | Skill profile, frontend | North Star / conversation | active |
| EK-003 | The first implementation should prove the product loop before replacing the manual transcript path. | The central product risk is whether transcript-derived resume and skill-profile output is useful, not whether transcription automation can be integrated immediately. | MVP scope, implementation order | CJ-001 | active |
| EK-004 | Infrastructure automation should not be allowed to obscure product validation. | OAuth, API credentials, billing, audio upload handling, Drive permissions, and Docs formatting are integration risks rather than the core value hypothesis. | Roadmap, risk management | CJ-001 / RR-005 | active |
| EK-005 | A static browser-first implementation is sufficient for V1. | Audio recording, drag/drop file intake, transcript paste, local generation, and visualization can all be demonstrated client-side. | Stack, implementation scope | CJ-002 / RR-006 | active |
| EK-006 | V1 UI should communicate current capability honestly. | The app can intake recordings but cannot yet transcribe them automatically; labels must avoid implying hidden automation. | UX, product truthfulness | CJ-003 / RR-007 | active |
| EK-007 | Skill profile numbers should be framed as evidence strength. | Percentage-style values can help visualize transcript support, but should not be mistaken for validated assessment. | Skill profile, responsible AI | CJ-003 / RR-008, CJ-008 / RR-013 | active |
| EK-008 | Target role/task context improves the usefulness of local generation before API automation. | Transcript-only analysis can identify strengths, but target context is needed to discuss fit and evidence gaps. | Resume generation, skill profile | CJ-004 / RR-009 | active |
| EK-009 | Artifact-level export is the V1 bridge toward later Google Docs/Drive integration. | Downloading generated resume/profile artifacts proves output portability without adding separate session-file management. | Export, storage, roadmap | CJ-005 / RR-010 | active |
| EK-010 | Automated transcription should be isolated as V2A. | Transcription can be validated independently before adding Google OAuth, Drive persistence, or Docs export. | Transcription, roadmap | CJ-006 / RR-011 | active |
| EK-011 | Keyword matching is insufficient for resume/profile generation. | Resume claims require evidence interpretation, target comparison, gap detection, and follow-up question generation. | Resume generation, feedback | CJ-007 / RR-012 | active |
| EK-012 | Evidence evaluation needs plain builder-facing documentation. | The meaning and limits of `evidenceStrength` must be explicit so users do not confuse model judgment with validated candidate scoring. | Documentation, responsible AI | CJ-008 / RR-013 | active |
| EK-013 | Naming should make the collaborative resume project immediately visible. | The tool is intended for 42 students working through the collaborative resume project, not as a generic resume generator. | Product identity, adoption | CJ-009 / RR-014 | active |
| EK-014 | The collaborative_resume project requires mutual interview evidence, resume PDF output, review, and privacy responsibility. | The source project asks pairs to interview each other, write each other's resumes, export PDFs, and avoid publishing resumes that do not belong to them. | Product scope, UX, documentation | collaborative_resume PDF / CJ-010 | active |
| EK-015 | The app now has frontend and backend components, matching the B1 Builders deliverable expectation. | Browser UI handles recording and artifacts; the local Node backend coordinates AI transcription/generation while keeping API keys server-side. | B1 submission readiness, architecture | B1 Builders Programme PDF / CJ-010 | active |
| EK-016 | Follow-up questions are part of the product, not merely output decoration. | Missing evidence should lead into a second interview pass so the resume can be strengthened responsibly. | Interview workflow, generation quality | CJ-010 / RR-015 | active |
| EK-017 | PDF export belongs after follow-up incorporation. | A first-pass resume is useful for review, but the project output should reflect the improved final resume after follow-up questions. | Export, collaborative_resume alignment | CJ-010 / RR-016 | active |
| EK-018 | Documentation should explain what the builder did and what AI did. | B1 Builders explicitly expects students to explain tools used, AI collaboration, prompts, review points, and decisions. | README, presentation readiness | B1 Builders Programme PDF / CJ-010 | active |
| EK-019 | Naming should be consistent across product identity, directory, package metadata, and constitutional artifacts. | A reviewer should not have to reconcile `earfully_resume` paths with the current collaborative_resume-builder purpose. | Repository clarity, submission readiness | CJ-011 / RR-018 | active |
| EK-020 | The technical build should be documented separately from product architecture. | The architecture doc stabilizes conceptual structure; the technical build doc explains implementation data flow, endpoints, APIs, and limits. | Documentation, reviewer readiness | CJ-012 / RR-019 | active |

## Dependency Map

| ID | Dependent Item | Depends On | Severity Tier | Status | Blocking? | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| DEP-001 | Automated transcription | Gemini or OpenAI API key and local backend server | Tier 3 | implemented for local prototype | no | Backend tries Gemini first and OpenAI fallback where configured; provider quota and format support still affect reliability. |
| DEP-002 | Google Doc output | Google OAuth and Docs/Drive API setup | Tier 3 | unresolved | no | Later-stage integration. |
| DEP-003 | Resume generator quality | Transcript structure, applicant identity, fixed collaborative_resume job context, AI evidence-governed generation, and follow-up transcript | Tier 2 | in progress | yes | Part 2 now strengthens output by combining initial resume evidence with follow-up transcript evidence. |
| DEP-004 | Cloud artifact storage | Resume/profile artifact formats and Google Drive/Docs API decisions | Tier 3 | deferred | no | V1 keeps local artifact downloads; cloud persistence remains later-stage. |
| DEP-005 | B1 submission readiness | README completeness, repository structure, demo evidence, and reflection | Tier 3 | in progress | no | README is being aligned with the B1 Builders Programme PDF. |

## Unresolved Issues

| ID | Issue | Type | Severity Tier | Impact | Required Action | Reasoning Status | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| UI-001 | Exact technology stack for frontend/backend is not locked. | ambiguity | Tier 3 | Resolved by LT-008 for V1. | clarify | V1 uses local browser app; backend deferred. | closed |
| UI-002 | Exact final resume output format is not fully locked. | ambiguity | Tier 3 | Affects generation prompts and PDF quality. | refine through testing | Current schema is evidence-governed and supports PDF export after follow-up, but exact final polish may still change. | open |
| UI-003 | Exact skill profile visual format is not locked. | ambiguity | Tier 3 | Affects frontend design and data schema. | clarify | Current version uses evidence cards; richer visual formats remain open. | open |
| UI-004 | Whether the typo `quesions` should be preserved or corrected. | ambiguity | Tier 4 | Affected visible Part 2 heading only. | corrected | The UI now uses `Part 2 - Follow-up questions`. | closed |

## Accepted Uncertainty

| ID | Uncertainty | Rationale for Acceptance | Scope | Revisit Trigger |
| --- | --- | --- | --- | --- |
| AU-001 | Automated transcription reliability varies by provider, quota, and audio format. | Gemini/OpenAI can be wired locally, but real-world reliability depends on account quota, MIME support, and recording quality. | Transcription layer | Before presenting the tool as broadly reliable for all 42 students. |
| AU-002 | Google Docs integration is not selected for MVP. | Resume can first render inside the web app. | Output layer | Before v2 Google integration. |
| AU-003 | Skill profile evidence strength is model-assigned and unvalidated. | Gemini can judge transcript support, but this is not a deterministic formula or formal candidate assessment. | Skill profile scoring | Before using scores for any formal evaluation or matching decision. |
| AU-004 | The current README can describe the workflow without screenshots yet. | The B1 PDF requests screenshots/GIF/video for demo; text documentation can be filled now and media can be added later. | B1 submission documentation | Before final B1 submission. |

## Warning Registry

No active warnings.

## Clarification Frontier

### Active Clarification Question

What exact final resume schema, PDF polish level, and skill-profile evidence rubric should be used before collaborative_resume_builder is treated as a submission-ready tool for many 42 students?

### Adjacent Unresolved Branches

- Resume output schema.
- Model-backed skill profile scoring and validation.
- Automated transcription provider.
- Google Docs export format.
- Demo screenshots or video for B1 submission documentation.

## Suggested Next Reasoning Focus

Test the complete Part 1 to Part 2 loop with real collaborative_resume interviews, then refine the final PDF output and README/demo evidence for B1 submission readiness.
