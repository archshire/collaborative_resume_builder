# Claude project guidance

This file is the working contract for Claude or another coding assistant modifying CRB. Read [`README.md`](README.md), [`docs/CURRENT_STATE.md`](docs/CURRENT_STATE.md), and [`CONTRIBUTING.md`](CONTRIBUTING.md) before changing application behaviour.

## Product intent

CRB means **Collaborative Resume (Contribution) Builder**.

> Understand the need. Develop the capability. Demonstrate the contribution.

The applicant journey should remain quick and humane. Begin with the organisation's need, collect the smallest useful amount of evidence, and let the resume emerge from reviewed source material. Do not turn the experience into a long mandatory questionnaire.

The employer experience is evidence review by a human. It is not an automated hiring decision system.

## Non-negotiable product rules

1. Do not invent candidate facts, achievements, dates, tools, qualifications, outcomes or quotations.
2. Treat job descriptions as relevance context, never as evidence about an applicant.
3. Keep supported evidence, partial evidence, self-report and missing evidence distinct.
4. Missing evidence is not proof that a person lacks a capability.
5. Additional answers can reveal existing capability; answering questions does not create a new skill.
6. Private practice answers, recordings and interviewer statements must remain outside company-visible material unless the applicant explicitly approves them.
7. Do not infer an applicant speaker from punctuation or an ambiguous speaker number.
8. Do not add automatic rejection, opaque ranking or an unexplained fit score.
9. Evidence coverage must remain traceable to requirements and excerpts. Its current weights are supported `1`, partial `0.5`, self-reported `0`, and no evidence `0`.
10. AI output must be editable and reviewed before external sharing.

## Current routes

| Route | Purpose |
| --- | --- |
| `/applicant` | Applicant landing, six-stage workspace and one-click demos. |
| `/company` | Company login, opportunity requirements and candidate review. |
| `/interview` | Original interview engine retained for its complete controls. |

Demo credentials are `applicant / hireme` and `company / rightfit`. They are fixtures, not authentication.

## Code map

| Area | Primary files |
| --- | --- |
| Route selection | `src/entry.ts` |
| Applicant/company shell and evidence charts | `src/native-shell.ts`, `src/native-shell.css` |
| Interview, audio, transcript, generation and export | `src/main.ts`, `src/styles.css` |
| Completed demo fixtures | `src/applicant-demo.ts`, `src/company-demo.ts` |
| Demo login and approved snapshot filtering | `src/demo-access.ts` |
| Resume upload review | `src/resume-import.ts`, `server/resume-import.cjs` |
| Incremental transcription | `src/transcription.ts` |
| Backend routing/provider calls | `server/index.cjs` |
| SSRF and local-request controls | `server/security.cjs` |
| Evidence isolation | `server/evidence.cjs` |
| Runtime schemas | `server/validation.cjs`, `server/response-formats.cjs` |
| Opportunity/reflection validation | `server/opportunity.cjs`, `server/reflection.cjs` |

`src/native-shell.ts` mounts and rearranges DOM owned by `src/main.ts`; it deliberately reuses the interview engine rather than duplicating it. Be careful when renaming IDs, moving initialization, or changing export functions because both surfaces and browser tests depend on them.

## Data boundaries

- Applicant/company one-click records are fictional source-controlled fixtures.
- Live workspace state exists only in browser memory and mounted fields.
- The three-candidate company board is not backed by three applicant accounts.
- Live applicant approval creates only an in-tab snapshot.
- There is no database, cloud storage, tenant isolation or production session recovery.
- `.env` is ignored and must never be read into logs, committed, or exposed to browser code.

State limitations must remain explicit in UI and documentation. Do not describe a fixture as a working multi-user feature.

## Security invariants

Keep local mode bound to loopback. Hosted mode may bind publicly only with an exact HTTPS origin, a configured outer demo password and paid-endpoint rate limiting. Preserve same-origin checks, the required JSON client header, body limits, timeouts, static-path containment, public-address validation, redirect revalidation and DNS-pinned URL fetching.

Do not weaken URL controls to support a difficult job site. Provide paste/upload fallback instead. A public deployment requires real authentication and authorization; the local controls are insufficient.

## AI integration rules

- Provider calls belong in the backend.
- Validate request fields before provider calls.
- Validate every provider response before rendering it.
- Preserve user input on timeout, rejection or malformed output.
- Never silently substitute sample content after a live AI failure.
- Exact source matching proves presence, not truth or semantic relevance; retain human review.
- Recordings and transcripts may contain sensitive personal data. Avoid unnecessary logging.
- The checked-in `.env.example` uses OpenAI. Optional Gemini paths remain in parts of the backend.

## Making changes

1. Identify whether the change affects the applicant flow, company flow, original interview engine, or shared backend.
2. Preserve the current six-stage applicant sequence and optional top-level Profile unless a product decision explicitly changes it.
3. Add a meaningful regression test for changes involving data loss, privacy, authorization, evidence classification, provider validation or cross-stage state.
4. Keep demo fixtures internally consistent across opportunity, transcript, evidence and resume.
5. Update README or CURRENT_STATE when capabilities or limitations change.
6. Run the checks in [`CONTRIBUTING.md`](CONTRIBUTING.md).

## Definition of done

- Intended behaviour works in the relevant route.
- Applicant evidence remains source-grounded.
- Private material is not exposed to the company view.
- Empty, error, loading and retry states remain understandable.
- Keyboard focus and narrow-screen layout remain usable.
- Node tests, type check, production build, backend syntax and relevant Playwright tests pass.
- No `.env`, recording, generated export or test artifact is staged.
- Documentation distinguishes the demo from production architecture.

Do not merge, deploy, publish or push unless the repository owner explicitly asks.
