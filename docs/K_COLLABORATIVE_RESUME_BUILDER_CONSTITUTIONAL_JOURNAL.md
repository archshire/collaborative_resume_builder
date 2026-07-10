# K_COLLABORATIVE_RESUME_BUILDER_CONSTITUTIONAL_JOURNAL

## Process Documentation Note

The end product has evolved significantly in both capability and name. The project began as `earfully_resume`, a listening-oriented resume assistant, and evolved into `collaborative_resume_builder`, a two-part AI-assisted tool for the 42 `collaborative_resume` project.

This journal is process documentation. It records the AI collaboration journey: vision clarity with Arche Reconstruction & Engineering Nexus (AREN), implementation clarity through Codex + KRYSTALIZE, runtime AI integration through Gemini/OpenAI, and repeated revision based on observed output. Earlier entries are preserved as historical reasoning, not necessarily as the current product state.

## Table of Contents

- [Process Documentation Note](#process-documentation-note)
- [Document Metadata](#document-metadata)
- [Initial Intent](#initial-intent)
- [Clarification Sessions](#clarification-sessions)
- [Clarification Rationale Tracking](#clarification-rationale-tracking)
- [Resolution Rationale](#resolution-rationale)
- [Deferred Issues](#deferred-issues)
- [Established Knowledge Changes](#established-knowledge-changes)
- [Traceability Index](#traceability-index)

## Document Metadata

```yaml
artifact_type: constitutional_journal
protocol: KRYSTALIZE
protocol_version: 1
session_id: KRYS-collaborative_resume_builder-001
project_name: collaborative_resume_builder
created_at: 2026-07-08
updated_at: 2026-07-10
status: draft
```

## Initial Intent

The builder wants to attempt a working version of the first individual-use project described in the Project Listen north star: a resume interview assistant.

The application should help students capture an interview, produce a transcript, generate a professional resume, and optionally generate an evidence-backed skill profile.

## Clarification Sessions

### Session CJ-001 - MVP Shape

```yaml
session_id: CJ-001
krystalize_session_id: KRYS-collaborative_resume_builder-001
date: 2026-07-08
participants:
  - Builder
  - Codex
scope: MVP workflow and automation staging
```

#### Clarification Target

Clarify whether to build a fully automated transcription-to-document app immediately or stage the project.

#### Reasoning Path Summary

The builder first wanted an individual-use application aligned with the Project Listen north star: a resume interview assistant that captures student interview speech and turns it into a resume and evidence-backed skill profile.

The discussion explored whether existing tools could reduce implementation complexity. Word Transcribe was considered conceptually relevant but rejected as a required dependency because the builder wants something broadly usable without depending on Microsoft Word.

The conversation then explored Google and Gemini options:

- Google Docs and Drive can support later document storage/output.
- Gemini app can manually transcribe or process audio, but cannot be cleanly embedded as a controlled app interface.
- Gemini API can later become the automated transcription layer, but introduces API setup, billing/limits, backend handling, and credential concerns.

The builder also considered whether ChatGPT extended listening or Gemini app workflows could prove the idea directly. This clarified the difference between a workflow prototype and a product prototype.

The stabilized conclusion was to build the product in stages:

```text
V1
Web app
-> records audio in 10-minute chunks
-> lets user download/save recordings
-> lets user drag/drop recordings back in
-> provides a transcript box
-> generates resume draft from transcript
-> generates evidence-backed skill profile visual from transcript

V1 transcription
audio chunk
-> Gemini app/API/manual transcript
-> paste transcript into app

V2
Gemini API transcription
-> Google login
-> save audio/transcript/resume to Drive
-> open generated resume as Google Doc
```

This became the start of the constitutional state for the app then known as Earfully Resume, now renamed `collaborative_resume_builder`.

#### V1 Before V2 Rationale

V1 exists to answer the product question:

```text
If a student interview becomes a transcript, can `collaborative_resume_builder` turn that transcript into a useful resume draft and evidence-backed skill profile?
```

V2 exists to answer the automation question:

```text
Can `collaborative_resume_builder` automate transcription, Google login, Drive storage, and Google Docs output smoothly?
```

The staged order was chosen because automated transcription and Google integration introduce infrastructure risk before the core product value has been validated.

V2 requires decisions and setup around:

- OAuth and Google login;
- API credentials;
- billing or quota limits;
- backend audio upload handling;
- audio format compatibility;
- Drive permissions;
- Docs API formatting;
- privacy wording.

If V2 is attempted first, implementation may spend too much effort on authentication, transcription, storage, and document plumbing before proving whether the transcript-to-resume/profile loop is valuable.

Therefore:

```text
V1 proves the value.
V2 smooths and automates the workflow.
```

#### Ambiguity Severity

Tier 2 - Structural dependency destabilizing.

#### Prioritization Rationale

The transcription path affects architecture, API dependencies, privacy, cost, and implementation order.

#### Traversal Layer

WHY to HOW.

#### Locked Outcomes

- `collaborative_resume_builder` is the first individual-use project.
- The MVP should prove the user journey before full automation.
- The first build target is a web app with audio chunk recording, saved recordings, drag/drop recording intake, transcript input, resume generation, and evidence-backed skill profile visualization.
- Manual transcript paste is acceptable for the first build.
- Automated transcription remains a later target.
- Google login, Drive storage, Docs output, and automated transcription are deferred until the product loop is proven.

#### Remaining Unresolved Issues

- Final transcription provider.
- Google Docs integration timing.
- Frontend/backend stack.
- Skill visualization format.

#### Conversational Reflection Summary

The project stabilized around a staged approach: first prove the interview-to-resume/profile experience, then automate transcription and document output after the core workflow is clear.

### Session CJ-002 - V1 Technical Shape

```yaml
session_id: CJ-002
krystalize_session_id: KRYS-collaborative_resume_builder-001
date: 2026-07-08
participants:
  - Builder
  - Codex
scope: V1 implementation stack
```

#### Clarification Target

Clarify whether V1 should be a fully local browser app or include a small backend from the start.

#### Ambiguity Severity

Tier 3 - Implementation destabilizing.

#### Prioritization Rationale

Implementation cannot begin cleanly until the V1 technical shape is locked.

#### Traversal Layer

HOW to WHAT.

#### Locked Outcomes

- V1 will be a local browser app.
- V1 will not include backend services, login, database, external AI APIs, Drive integration, or Docs integration.
- V1 should use Vite + plain TypeScript where practical.
- Because the current machine has Node `v12.22.9`, Vite/TypeScript versions should be pinned to versions compatible with that environment unless Node is upgraded later.

#### Conversational Reflection Summary

The builder accepted the local-first recommendation. This keeps V1 focused on demonstrating the product loop: recording, transcript intake, local resume generation, and evidence-backed skill visualization.

### Session CJ-003 - V1 Capability Honesty and UI Refinement

```yaml
session_id: CJ-003
krystalize_session_id: KRYS-collaborative_resume_builder-001
date: 2026-07-08
participants:
  - Builder
  - Codex
scope: V1 UI wording and capability boundaries
```

#### Clarification Target

Clarify what V1 actually does today versus what belongs to later automation.

#### Reasoning Path Summary

The builder reviewed the working V1 interface and asked whether the app can actually transcribe audio. This clarified that the current Transcribe control is not automated speech-to-text. It supports a manual bridge: collect recordings, send them to Gemini or another transcription tool, then paste the transcript back into the app.

The builder also asked how the skill-profile percentages are generated. This clarified that the current scores are keyword-match heuristics based on transcript evidence. They are useful as a visual signal of evidence density, but they are not validated ability scores or formal candidate assessments.

The UI was therefore adjusted to reduce misleading surface language:

- Small section labels such as "Capture" and "Transcription" were removed.
- Main section headings were made uppercase for clearer panel identity.
- Skill profile percentages were labeled as evidence strength.

#### Ambiguity Severity

Tier 4 - Cosmetic / low-risk for headings.

Tier 3 - Implementation destabilizing for transcription and scoring capability boundaries.

#### Prioritization Rationale

The interface must not imply that V1 performs automated transcription or formal candidate scoring when it does not. Clear wording preserves trust while keeping the staged roadmap intact.

#### Traversal Layer

WHAT to HOW.

#### Locked Outcomes

- V1 does not yet perform automated audio-to-text transcription.
- V1 transcription remains a manual bridge through Gemini or another external transcription tool.
- V1 skill profile percentages represent heuristic transcript evidence strength.
- UI headings should be concise and clearly identify each working panel.

#### Remaining Unresolved Issues

- Automated transcription provider.
- Model-backed profile scoring or evidence extraction.
- Final resume schema.

#### Conversational Reflection Summary

The project kept its staged philosophy: V1 should be honest about what works locally now, while preserving a clean path toward automated transcription and stronger AI-backed scoring later.

### Session CJ-004 - Candidate and Target Context Slice

```yaml
session_id: CJ-004
krystalize_session_id: KRYS-collaborative_resume_builder-001
date: 2026-07-08
participants:
  - Builder
  - Codex
scope: V1 transcript-to-output quality
```

#### Clarification Target

Improve the local V1 product loop before adding automated transcription.

#### Reasoning Path Summary

The builder asked what should come next after the initial V1 interface. The next useful slice was identified as tightening the transcript-to-output loop rather than adding API automation immediately.

The reason is that transcript-only generation can identify candidate strengths and interests, but it cannot meaningfully explain fit without knowing the job, role, task, or opportunity the candidate is preparing for. The application therefore added candidate name and target job/task context fields before the transcript. Resume generation and skill-profile generation now use that context to produce role/task fit and evidence-gap signals.

#### Ambiguity Severity

Tier 3 - Implementation destabilizing.

#### Prioritization Rationale

Target context is required for the north-star behavior: showing how a candidate's strengths and interests match a job task, and where evidence is missing. This improves product value without introducing transcription APIs, OAuth, billing, backend storage, or Google Docs integration.

#### Traversal Layer

HOW to WHAT.

#### Locked Outcomes

- V1 now includes candidate name and target job/task context fields.
- Resume generation includes target role/task context when provided.
- Skill profile generation includes role-fit and evidence-gap cards when target context is provided.
- The implementation remains local browser-only and heuristic.

#### Remaining Unresolved Issues

- Final resume schema.
- Stronger model-backed evidence extraction.
- Automated transcription provider.
- Google Docs export path.

#### Conversational Reflection Summary

This change keeps V1 focused on proving the actual product value: can an interview transcript plus target context become a useful resume draft and evidence-backed profile?

### Session CJ-005 - Artifact-Level Local Export

```yaml
session_id: CJ-005
krystalize_session_id: KRYS-collaborative_resume_builder-001
date: 2026-07-08
participants:
  - Builder
  - Codex
scope: V1 artifact export behavior
```

#### Clarification Target

Add practical artifact export behavior before Google Drive and Docs automation.

#### Reasoning Path Summary

After adding candidate and target context, the next useful V1 improvement was to make generated outputs portable. The first proposal included top-level session tools, but the builder clarified that session save/load was unnecessary weight for V1.

The refined decision is artifact-level export: place Download Resume inside the resume section and Download Skill Profile inside the skill-profile section. Audio files, transcript text, and generated artifacts are sufficient for the current V1 surface.

#### Ambiguity Severity

Tier 3 - Implementation destabilizing.

#### Prioritization Rationale

Generated resume/profile output should not be trapped inside the page, but controls should live next to the artifact they affect. Artifact-level export creates a working student-facing path without introducing OAuth, cloud storage permissions, Docs API formatting, or extra session-file management.

#### Traversal Layer

WHAT.

#### Locked Outcomes

- Resume output can be downloaded as Markdown.
- Skill profile output can be downloaded as Markdown.
- Download controls belong inside their related output panels.
- V1 does not include separate save/load session controls.

#### Remaining Unresolved Issues

- Google Docs resume export.
- Richer profile visual export format.
- Google Drive artifact persistence.

#### Conversational Reflection Summary

Artifact-level export makes V1 feel like a usable tool while keeping cloud automation properly deferred and the interface lighter.

### Session CJ-006 - V2A Gemini API Transcription

```yaml
session_id: CJ-006
krystalize_session_id: KRYS-collaborative_resume_builder-001
date: 2026-07-08
participants:
  - Builder
  - Codex
scope: V2A automated transcription
```

#### Clarification Target

Move from manual transcription bridge to automated Gemini API transcription without adding the rest of Google integration yet.

#### Reasoning Path Summary

The builder confirmed readiness to begin V2 and selected Gemini API transcription. The implementation was intentionally scoped as V2A: uploaded audio is sent to a local backend, the backend keeps `GEMINI_API_KEY` out of browser code, and Gemini returns transcript text to the existing transcript box.

Google login, Drive persistence, and Docs output remain deferred. This preserves the staged approach: automate transcription first, then add cloud identity/storage/document automation only after the audio-to-transcript link is working.

#### Ambiguity Severity

Tier 3 - Implementation destabilizing.

#### Prioritization Rationale

Automated transcription is the next dependency that materially improves the product loop. It can be isolated from OAuth and document automation, reducing the chance that V2 becomes too broad to verify.

#### Traversal Layer

HOW to WHAT.

#### Locked Outcomes

- V2A uses a local backend endpoint at `/api/transcribe`.
- Gemini API key is read from `.env` server-side.
- Uploaded audio files are transcribed in order.
- Transcript output is inserted into the existing transcript box.
- Manual transcription prompt remains as fallback when Gemini transcription fails.
- Inline audio is limited to small files for now; larger-file support can later use Gemini Files API.

#### Remaining Unresolved Issues

- Real transcription requires the builder's Gemini API key.
- Larger-file transcription through Gemini Files API.
- Google login, Drive storage, and Docs output.

#### Conversational Reflection Summary

V2A turns the most painful manual step into a real app capability while keeping the rest of the Google ecosystem outside the blast radius for now.

### Session CJ-007 - Evidence-Governed Resume and Feedback Layer

```yaml
session_id: CJ-007
krystalize_session_id: KRYS-collaborative_resume_builder-001
date: 2026-07-08
participants:
  - Builder
  - Codex
scope: Resume/profile generation quality
```

#### Clarification Target

Replace incoherent keyword-based resume/profile generation with an AI layer that understands transcript evidence and missing information.

#### Reasoning Path Summary

The builder tested a real transcript against a junior freelance developer target task. The generated resume exposed a major flaw: the local heuristic generator treated keyword matches as evidence and produced incoherent role-fit claims. This contradicted the product philosophy that resume claims should be traceable to interview evidence.

The generation path was therefore changed. Resume/profile generation now calls a local backend endpoint that asks Gemini to return structured JSON containing:

- a formatted resume draft;
- evidence-backed profile cards;
- missing-evidence feedback;
- follow-up questions the interviewer should ask next.

The prompt explicitly states that candidate claims must come from the transcript only, while the target job/task is used only for fit comparison and gap detection.

#### Ambiguity Severity

Tier 2 - Structural dependency destabilizing.

#### Prioritization Rationale

If the app invents or misclassifies resume evidence, it fails the core north-star purpose. A resume assistant needs evidence discipline before export, Google Docs integration, or visual polish matters.

#### Traversal Layer

WHY to HOW to WHAT.

#### Locked Outcomes

- Keyword-only resume/profile generation is not acceptable as the main generation path.
- Gemini-backed generation should produce structured resume, profile, and feedback artifacts.
- Target job/task context must not be treated as evidence about the candidate.
- Missing target requirements should become follow-up questions, not invented resume claims.

#### Remaining Unresolved Issues

- Output quality must be tested with more real transcripts.
- The exact final resume schema may still be refined.
- Model-backed scoring remains heuristic unless validated.

#### Conversational Reflection Summary

This correction strengthens the product philosophy: the app should not merely produce an impressive resume; it should help the interviewer discover what evidence is missing.

### Session CJ-008 - Evidence Strength Documentation

```yaml
session_id: CJ-008
krystalize_session_id: KRYS-collaborative_resume_builder-001
date: 2026-07-08
participants:
  - Builder
  - Codex
scope: Evidence evaluation documentation
```

#### Clarification Target

Explain how Gemini's skill-profile evaluation works and prevent the displayed percentages from being mistaken for formal candidate assessment scores.

#### Reasoning Path Summary

After testing the Gemini-backed generation layer, the builder agreed with Gemini's qualitative assessment but asked how the percentage-style evidence values are calculated.

This clarified an important documentation boundary: the current `evidenceStrength` value is not a deterministic local scoring formula. It is a model-assigned estimate returned by Gemini, based on how strongly the transcript supports a skill or role-fit card relative to the target job/task. The target job/task is comparison context, not evidence about the candidate.

The README was updated to explain the two-step Gemini flow:

- audio-to-transcript transcription;
- transcript-plus-target evidence generation.

It now documents the source boundary, the meaning of `evidenceStrength`, the role of evidence and gaps, and the intended use of low scores as follow-up interview guidance.

#### Ambiguity Severity

Tier 3 - Implementation and interpretation boundary.

#### Prioritization Rationale

If the user or builder treats `evidenceStrength` as a validated ability score, the app drifts away from the Project Listen philosophy of evidence-backed reflection. The score should support better questioning, not replace human judgment.

#### Traversal Layer

HOW to WHAT.

#### Locked Outcomes

- `evidenceStrength` is Gemini-assigned, not locally calculated.
- The value estimates transcript support relative to the target task.
- The transcript remains the only source of truth for candidate claims.
- The target job/task can create gaps and follow-up questions, but cannot create candidate evidence.
- Documentation must make this limitation visible.

#### Remaining Unresolved Issues

- Whether future versions need a deterministic rubric in addition to Gemini judgment.
- Whether evidence-strength values should remain percentages or use simpler labels such as "missing", "weak", "moderate", and "strong".

#### Conversational Reflection Summary

The documentation now protects the product from overclaiming: the app can help reveal what the transcript supports, but it should not pretend to be a validated hiring assessment system.

### Session CJ-009 - Project-Facing Name Clarification

```yaml
session_id: CJ-009
krystalize_session_id: KRYS-collaborative_resume_builder-001
date: 2026-07-08
participants:
  - Builder
  - Codex
scope: Product naming and identity
```

#### Clarification Target

Clarify the product-facing name so the app points directly to the 42 collaborative resume project it is meant to support.

#### Reasoning Path Summary

The builder clarified that the app exists as a solution to the collaborative resume project and should draw attention to that purpose in its name.

The earlier working name, Earfully Resume, emphasized listening and resume generation. The clarified name, `collaborative_resume_builder`, emphasizes the target use case: helping 42 students in Circle 6 work through the collaborative resume project without multitasking between recording, transcription, resume drafting, and evidence review.

The chosen description is:

```text
A tool to help 42 students in Circle 6 enjoy the project without multitasking.
```

#### Ambiguity Severity

Tier 2 - Product identity and adoption.

#### Prioritization Rationale

If the name sounds like a generic resume generator, the app's relationship to the collaborative_resume project is easy to miss. Clear naming improves adoption and preserves the north-star intent.

#### Traversal Layer

WHY to WHAT.

#### Locked Outcomes

- The project-facing name is `collaborative_resume_builder`.
- The name should preserve the lowercase `collaborative_resume` form.
- "Builder" should remain capitalized for app identity and clarity.
- The description should foreground 42 students in Circle 6 and the desire to reduce multitasking.

#### Remaining Unresolved Issues

- Whether the browser UI should be renamed immediately or in a separate implementation pass.
- Whether repository directory names and constitutional artifact filenames should eventually be renamed or preserved for continuity.

#### Conversational Reflection Summary

The naming now carries the project intent plainly: this is a practical builder tool for the collaborative_resume experience, not merely a general interview-to-resume demo.

### Session CJ-010 - Two-Part Interview Loop and B1 Documentation Alignment

```yaml
session_id: CJ-010
krystalize_session_id: KRYS-collaborative_resume_builder-001
date: 2026-07-10
participants:
  - Builder
  - Codex
scope: Part 1/Part 2 workflow and B1 Builders README requirements
```

#### Clarification Target

Clarify how the app should move from a single transcript-to-resume pass into a fuller collaborative_resume exercise that uses feedback to collect missing evidence.

#### Reasoning Path Summary

After testing transcription and AI generation, the builder identified that a useful resume assistant should not stop at the first resume draft. The first transcript may reveal missing evidence. The app should therefore help the interviewer ask better follow-up questions, capture a second recording, transcribe it, and regenerate the resume and skill profile from the combined evidence.

The product was restructured into:

```text
Part 1 - Initial Interview
-> context
-> recruiter/applicant identity
-> guided interview questions
-> recording and transcription
-> initial resume/profile/feedback

Part 2 - Follow-up questions
-> follow-up readiness gate
-> follow-up recording
-> follow-up transcription
-> updated resume/profile generation
-> final resume PDF export
```

The collaborative_resume PDF clarified that the source school project requires mutual interviews, structured resume writing, peer review, PDF export, and privacy responsibility. The B1 Builders Programme PDF clarified that the repository README should explain the problem, outcome, demo flow, technology stack, AI collaboration, installation, usage, project structure, and reflection.

#### Ambiguity Severity

Tier 2 - Structural dependency destabilizing.

#### Prioritization Rationale

The one-pass flow was useful but incomplete. The missing-evidence feedback becomes materially more valuable when it drives a second interview pass. This also aligns the app more closely with the collaborative_resume project, where interviewing, clarification, writing, exchange, and review are part of the learning outcome.

#### Traversal Layer

WHY to HOW to WHAT.

#### Locked Outcomes

- The app is now organized as Part 1 initial interview and Part 2 follow-up questions.
- Part 2 has its own recorder and transcription area.
- Part 2 recording does not repeat recruiter/applicant identity fields.
- Part 2 recording requires an explicit "Ready to ask follow-up questions" action before recording.
- Follow-up files are named with the applicant slug and `_follow_up`.
- The final resume PDF export belongs to the Part 2 updated resume.
- README documentation should be aligned with B1 Builders Programme expectations.

#### Remaining Unresolved Issues

- The Part 2 heading typo `quesions` has been corrected to `questions`.
- Whether to add screenshots, GIFs, or video for final B1 submission.
- Whether final PDF formatting should become richer before broad student use.
- Whether a deterministic evidence rubric should complement Gemini/OpenAI model judgment.

#### Conversational Reflection Summary

The app shifted from an interview-to-resume generator into an interview-improvement tool. The AI feedback layer now has a job: reveal missing evidence, help the interviewer ask better follow-up questions, and make the final resume stronger.

### Session CJ-011 - Canonical Repository Rename

```yaml
session_id: CJ-011
krystalize_session_id: KRYS-collaborative_resume_builder-001
date: 2026-07-10
participants:
  - Builder
  - Codex
scope: project identity, directory naming, and constitutional artifact naming
```

#### Clarification Target

Clarify whether the early working directory name `earfully_resume` should remain now that the product identity has stabilized around the 42 `collaborative_resume` project.

#### Reasoning Path Summary

The builder clarified that although the project began with the listening-oriented working name Earfully Resume, the actual app is now a support tool for the `collaborative_resume` school project. Keeping the old directory and package name would create unnecessary friction for reviewers and future AI collaborators because the codebase identity would no longer match the product purpose.

The repository directory was therefore renamed:

```text
earfully_resume
-> collaborative_resume_builder
```

The same canonical identity was applied to package metadata, README structure, browser title, server log text, and KRYSTALIZE artifact filenames:

```text
K_EARFULLY_RESUME_CONSTITUTIONAL_STATE.md
-> K_COLLABORATIVE_RESUME_BUILDER_CONSTITUTIONAL_STATE.md

K_EARFULLY_RESUME_CONSTITUTIONAL_JOURNAL.md
-> K_COLLABORATIVE_RESUME_BUILDER_CONSTITUTIONAL_JOURNAL.md
```

Historical references to Earfully Resume are preserved only where they explain the project's naming evolution.

#### Ambiguity Severity

Tier 2 - Product identity and repository traceability.

#### Prioritization Rationale

The B1 submission and future project work should not require readers to mentally translate between an old working name and the current app purpose. Consistent naming makes the repository easier to inspect, explain, and continue.

#### Traversal Layer

WHY to WHAT.

#### Locked Outcomes

- The canonical directory name is `collaborative_resume_builder`.
- The package name is `collaborative_resume_builder`.
- The active constitutional artifacts use `K_COLLABORATIVE_RESUME_BUILDER_*`.
- Earfully Resume remains only as a historical working-name reference.

#### Remaining Unresolved Issues

- Whether the visible UI heading should remain fully lowercase `collaborative_resume_builder` or return to the display-style `collaborative_resume Builder`.

#### Conversational Reflection Summary

The rename completes the identity shift. The project is no longer merely a resume-listening prototype; it is explicitly a builder tool for the collaborative_resume exercise.

### Session CJ-012 - Technical Build Documentation

```yaml
session_id: CJ-012
krystalize_session_id: KRYS-collaborative_resume_builder-001
date: 2026-07-10
participants:
  - Builder
  - Codex
scope: technical stack explanation and runtime flow documentation
```

#### Clarification Target

Clarify whether existing documentation explains how the build works technically, not only what the app is for.

#### Reasoning Path Summary

The builder asked whether the documentation explains how the tech stack works. The README already described the product, stack list, usage, and AI collaboration, while the architecture doc described the conceptual product flow. However, neither document explained the implementation path end-to-end: browser recording, Web Audio diagnostics, audio Blob handling, base64 upload, local Node endpoints, Gemini/OpenAI provider fallback, JSON artifact validation, rendering, and PDF export.

A dedicated technical build document was therefore added:

```text
docs/TECHNICAL_BUILD.md
```

The README now links to it, and the architecture document was updated to reflect the current backend-enabled prototype rather than the earlier manual-transcript MVP.

#### Ambiguity Severity

Tier 3 - Implementation explanation and reviewer readiness.

#### Prioritization Rationale

B1 review requires the builder to explain what tools were used and why. A technical build document helps the builder describe the system confidently without mixing product philosophy, AI collaboration, and implementation mechanics into one overloaded README.

#### Traversal Layer

HOW to WHAT.

#### Locked Outcomes

- `docs/TECHNICAL_BUILD.md` explains the current technical stack and runtime data flow.
- README links to the technical build document.
- Architecture has been updated to acknowledge the current local backend and AI endpoint design.

#### Remaining Unresolved Issues

- Whether to add diagrams or screenshots to the technical build document.
- Whether to add automated tests that correspond to the documented endpoints.

#### Conversational Reflection Summary

The documentation set now has clearer separation of concerns: North Star explains why, Architecture explains the conceptual system, Technical Build explains how the implementation works, and KRYSTALIZE records the reasoning trail.

## Clarification Rationale Tracking

| ID | Session | Clarification Path | Severity Tier | Why Prioritized | Dependency Branch | Instability Trigger |
| --- | --- | --- | --- | --- | --- | --- |
| CRT-001 | CJ-001 | Manual MVP before automated transcription | Tier 2 | Prevent API/auth/transcription setup from blocking workflow proof. | Transcription layer | Unclear whether Google/Gemini/Whisper should be automated immediately. |
| CRT-002 | CJ-001 | Product prototype after workflow exploration | Tier 2 | Distinguish proving the idea from building the final automated platform. | MVP scope | ChatGPT/Gemini could prove the workflow but would not yet be `collaborative_resume_builder` as an app. |
| CRT-003 | CJ-001 | V1 value validation before V2 automation | Tier 2 | Keep infrastructure risk from obscuring the core product hypothesis. | Roadmap staging | Google login, Drive, Docs, transcription APIs, and billing could dominate the build before product usefulness is known. |
| CRT-004 | CJ-002 | Local browser app before backend | Tier 3 | Allow implementation to start without API keys, OAuth, database, or server design. | V1 stack | The frontend/backend boundary was unresolved. |
| CRT-005 | CJ-003 | Capability honesty before automation | Tier 3 | Prevent the V1 interface from implying automated transcription or formal scoring. | UX truthfulness | Builder asked whether V1 can actually transcribe and how percentages are calculated. |
| CRT-006 | CJ-004 | Target context before API automation | Tier 3 | Improve fit/gap usefulness while preserving local V1 constraints. | Resume/profile quality | Transcript-only generation could not explain fit against a specific job task. |
| CRT-007 | CJ-005 | Artifact export before cloud storage | Tier 3 | Preserve usable outputs without introducing Google OAuth or Docs/Drive APIs. | Export/storage | Generated artifacts were trapped in the browser page except for copy behavior; session save/load was later rejected as unnecessary V1 weight. |
| CRT-008 | CJ-006 | Gemini transcription before Google identity/storage | Tier 3 | Validate automated audio-to-text before adding OAuth, Drive, or Docs dependencies. | Transcription layer | Builder confirmed V2A Gemini API transcription as the next step. |
| CRT-009 | CJ-007 | Evidence-governed generation before further automation | Tier 2 | Prevent incoherent or invented resume claims from becoming the product's core output. | Resume/profile quality | Builder identified that keyword-generated resume output did not make sense. |
| CRT-010 | CJ-008 | Document model-assigned evidence strength | Tier 3 | Prevent Gemini's evidence percentage from being misunderstood as a validated assessment score. | Documentation, responsible AI | Builder agreed with the assessment but asked how the calculation works. |
| CRT-011 | CJ-009 | Rename for collaborative_resume identity | Tier 2 | Align product-facing name with the 42 collaborative resume project and intended student users. | Product identity | Builder clarified that the app exists as a solution to the collaborative_resume project. |
| CRT-012 | CJ-010 | Split exercise into initial interview and follow-up interview | Tier 2 | Make missing-evidence feedback operational instead of decorative. | Interview workflow | Builder wanted the full exercise divided into Part 1 and Part 2. |
| CRT-013 | CJ-010 | Move final PDF export to updated resume | Tier 3 | Ensure final exported artifact reflects follow-up evidence. | Artifact export | Builder clarified that the first resume should not be the final PDF export point. |
| CRT-014 | CJ-010 | Align README with B1 Builders Programme PDF | Tier 3 | Prepare repository for project explanation and presentation expectations. | Documentation | Builder requested README completion according to B1 Builders Programme expectations. |
| CRT-015 | CJ-011 | Rename repository identity to `collaborative_resume_builder` | Tier 2 | Remove mismatch between old listening-oriented working name and current 42 project-facing identity. | Product identity, repository traceability | Builder requested relevant file and directory names be changed from `earfully_resume` to `collaborative_resume_builder`. |
| CRT-016 | CJ-012 | Add technical build documentation | Tier 3 | Explain how the frontend, backend, audio APIs, AI providers, and export flow work together. | Technical documentation | Builder asked whether any documentation explains how the tech stack works. |

## Resolution Rationale

| ID | Item Resolved | Resolution Type | Rationale | Authority Source | Linked State Item |
| --- | --- | --- | --- | --- | --- |
| RR-001 | MVP can begin with manual transcript paste. | clarified | This proves the core user journey without delaying on API setup. | Builder/Codex clarification | LT-003 |
| RR-002 | Automated transcription remains planned. | clarified | The desired future product includes a Transcribe button. | Builder clarification | LT-004 |
| RR-003 | First build target is staged v1 web app. | clarified | The app can demonstrate recording, transcript-driven resume generation, and evidence visualization before API automation. | Builder confirmation | LT-005 |
| RR-004 | Google integration belongs after v1. | deferred | OAuth, Drive, Docs, and transcription automation are valuable but not required to prove the initial product loop. | Builder/Codex clarification | LT-006 |
| RR-005 | V1 should precede V2. | clarified | V1 validates whether the transcript-to-resume/profile loop works; V2 then automates the workflow once value is proven. | Builder/Codex clarification | LT-007 |
| RR-006 | V1 uses local browser app architecture. | clarified | Browser APIs and local generation are sufficient to prove the V1 product loop. | Builder/Codex clarification | LT-008 |
| RR-007 | V1 Transcribe is a manual bridge, not automated speech-to-text. | clarified | The app has no transcription API or browser-side uploaded-audio transcription engine yet. | Builder/Codex clarification | LT-009 |
| RR-008 | Early V1 profile percentages were evidence-strength heuristics. | clarified | The original formula used keyword matches from transcript text, so the UI should not present the values as formal ability scores. Superseded for the current Gemini-backed path by RR-013. | Builder/Codex clarification | LT-010 |
| RR-009 | V1 should include target job/task context. | clarified | Role fit and deficiency analysis require a target to compare transcript evidence against. | Builder/Codex clarification | LT-011 |
| RR-010 | V1 should support local artifact export before cloud automation. | clarified | Resume/profile downloads prove output portability without OAuth, billing, API setup, or separate session-file management. | Builder clarification | LT-012 |
| RR-011 | V2A should automate transcription through Gemini API first. | clarified | Audio-to-text is the next highest-value automation and can be implemented without Google login, Drive, or Docs. | Builder confirmation | LT-013 |
| RR-012 | Resume/profile generation needs an AI feedback layer. | clarified | The app must identify missing evidence and follow-up questions instead of inventing fit from target-job text. | Builder correction | LT-014 |
| RR-013 | Evidence strength must be documented as model-assigned guidance. | clarified | Gemini returns the value as a judgment of transcript support; it is useful for follow-up questions but not a formal score. | Builder/Codex clarification | LT-015 |
| RR-014 | Project-facing name is `collaborative_resume_builder`. | clarified | The name is boring but clear, and directly signals the app's role in the 42 collaborative resume project. | Builder clarification | LT-016 |
| RR-015 | Follow-up questions should become a second recording/transcription loop. | clarified | Missing evidence is only useful if the app helps the interviewer collect it. | Builder clarification | LT-017, LT-019 |
| RR-016 | PDF export belongs to the updated resume after follow-up. | clarified | The first resume is an interim draft; the final artifact should incorporate follow-up evidence. | Builder clarification | LT-021 |
| RR-017 | README should follow B1 Builders Programme sections. | clarified | The programme assesses both the working prototype and the builder's ability to explain AI-assisted development. | B1 Builders Programme PDF / Builder request | LT-022 |
| RR-018 | Canonical repository identity is `collaborative_resume_builder`. | clarified | Directory, package, and constitutional artifact names should match the current product purpose and reduce reviewer confusion. | Builder clarification | LT-023 |
| RR-019 | Technical stack explanation belongs in `docs/TECHNICAL_BUILD.md`. | clarified | README and architecture should stay readable; detailed runtime mechanics need a focused document. | Builder request | LT-024 |

## Deferred Issues

| ID | Issue | Reason Deferred | Impact | Revisit Trigger | Linked Warning |
| --- | --- | --- | --- | --- | --- |
| DI-001 | Automated transcription provider | Not required for MVP workflow proof. | Later API integration. | Before v2/v3 Transcribe button. |  |
| DI-002 | Google Doc output | Not required for first app shell. | Later Google auth/docs integration. | Before v2 Drive/Docs work. |  |
| DI-003 | Google login and Drive storage | Not required for first proof of product experience. | Later storage/export integration. | After v1 recorder and generation flow works. |  |
| DI-004 | Backend architecture | Not required for local V1. | Later API and Google integration. | Before adding automated transcription or Drive/Docs output. |  |
| DI-005 | Google Docs/Drive automation | Local PDF/download output is sufficient for the current prototype. | Later smoother collaborative_resume submission flow. | After local Part 1/Part 2 loop is reliable. |  |
| DI-006 | Demo screenshots/video | README can describe the demo textually first. | B1 submission polish. | Before final repository submission or presentation. |  |

## Established Knowledge Changes

| ID | Date | State Knowledge ID | Change Type | Summary | Rationale / Trace Link | Status After Change |
| --- | --- | --- | --- | --- | --- | --- |
| EKC-001 | 2026-07-08 | EK-001 | added | Stage the product from workflow proof to automation. | CJ-001 | active |
| EKC-002 | 2026-07-08 | EK-002 | added | Skill profile visuals should be evidence-backed. | North Star / CJ-001 | active |
| EKC-003 | 2026-07-08 | EK-003 | added | First implementation should prove product loop before replacing manual transcription. | CJ-001 | active |
| EKC-004 | 2026-07-08 | EK-004 | added | Infrastructure automation should not obscure product validation. | CJ-001 / RR-005 | active |
| EKC-005 | 2026-07-08 | EK-005 | added | Static browser-first implementation is sufficient for V1. | CJ-002 / RR-006 | active |
| EKC-006 | 2026-07-08 | EK-006 | added | V1 UI should communicate current capability honestly. | CJ-003 / RR-007 | active |
| EKC-007 | 2026-07-08 | EK-007 | added | Skill profile numbers should be framed as evidence strength. | CJ-003 / RR-008 | active |
| EKC-008 | 2026-07-08 | EK-008 | added | Target role/task context improves local generation. | CJ-004 / RR-009 | active |
| EKC-009 | 2026-07-08 | EK-009 | refined | Artifact-level export is the V1 bridge toward Google Docs/Drive integration. | CJ-005 / RR-010 | active |
| EKC-010 | 2026-07-08 | EK-010 | added | Automated transcription should be isolated as V2A. | CJ-006 / RR-011 | active |
| EKC-011 | 2026-07-08 | EK-011 | added | Keyword matching is insufficient for resume/profile generation. | CJ-007 / RR-012 | active |
| EKC-012 | 2026-07-08 | EK-012 | added | Evidence evaluation needs plain builder-facing documentation. | CJ-008 / RR-013 | active |
| EKC-013 | 2026-07-08 | EK-013 | added | Naming should make the collaborative resume project immediately visible. | CJ-009 / RR-014 | active |
| EKC-014 | 2026-07-10 | EK-014 | added | collaborative_resume project requirements shape the app workflow. | CJ-010 | active |
| EKC-015 | 2026-07-10 | EK-015 | added | The app now satisfies frontend/backend prototype shape locally. | CJ-010 | active |
| EKC-016 | 2026-07-10 | EK-016 | added | Follow-up questions are operationalized as a second interview pass. | CJ-010 / RR-015 | active |
| EKC-017 | 2026-07-10 | EK-017 | added | Final PDF export belongs after follow-up incorporation. | CJ-010 / RR-016 | active |
| EKC-018 | 2026-07-10 | EK-018 | added | README should explain what the builder did and what AI did. | B1 Builders Programme PDF / CJ-010 | active |
| EKC-019 | 2026-07-10 | EK-019 | added | Naming is now consistent across directory, package, docs, and constitutional artifacts. | CJ-011 / RR-018 | active |
| EKC-020 | 2026-07-10 | EK-020 | added | Technical build documentation now separates implementation mechanics from conceptual architecture. | CJ-012 / RR-019 | active |

## Traceability Index

| Trace ID | Journal Entry | Related State Item | Source | Notes |
| --- | --- | --- | --- | --- |
| TR-001 | CJ-001 | LT-001, LT-003, LT-004, LT-005, LT-006, LT-007 | Builder/Codex conversation | MVP shape clarified before implementation. |
| TR-002 | CJ-002 | LT-008 | Builder/Codex conversation | V1 implementation stack clarified before app scaffold. |
| TR-003 | CJ-003 | LT-009, LT-010, EK-006, EK-007 | Builder/Codex conversation | V1 capability boundaries and UI wording clarified after first working interface review. |
| TR-004 | CJ-004 | LT-011, EK-008 | Builder/Codex conversation | Candidate and target context added to improve resume/profile usefulness before automation. |
| TR-005 | CJ-005 | LT-012, EK-009 | Builder/Codex conversation | Local artifact export added; separate session save/load removed after builder clarification. |
| TR-006 | CJ-006 | LT-013, EK-010 | Builder/Codex conversation | Gemini API transcription added as V2A before Google identity/storage/document automation. |
| TR-007 | CJ-007 | LT-014, EK-011 | Builder/Codex conversation | Heuristic resume/profile generation replaced with Gemini-backed evidence and feedback generation. |
| TR-008 | CJ-008 | LT-015, EK-012 | Builder/Codex conversation | README now explains Gemini evidence evaluation and the limits of `evidenceStrength`. |
| TR-009 | CJ-009 | LT-016, EK-013 | Builder/Codex conversation | Project-facing docs now use `collaborative_resume_builder` and its 42 Circle 6 description. |
| TR-010 | CJ-010 | LT-017, LT-018, LT-019, LT-020, LT-021, EK-014, EK-016, EK-017 | Builder/Codex conversation, collaborative_resume PDF | Part 1/Part 2 workflow added to make follow-up evidence collection part of the app. |
| TR-011 | CJ-010 | LT-022, EK-015, EK-018 | B1 Builders Programme PDF / Builder request | README aligned to B1 expected sections and AI-assisted development explanation. |
| TR-012 | CJ-011 | LT-023, EK-019 | Builder/Codex conversation | Directory, package metadata, README tree, and KRYSTALIZE artifact filenames renamed to `collaborative_resume_builder`. |
| TR-013 | CJ-012 | LT-024, EK-020 | Builder/Codex conversation | `docs/TECHNICAL_BUILD.md` added and linked from README/Architecture. |
