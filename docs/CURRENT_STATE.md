# CRB current state

Last reviewed: 13 September 2026

Working branch: `feat/crb-six-step-design`

This is a handover snapshot for the next contributor. Read [`../README.md`](../README.md) for the full product and architecture and [`../CLAUDE.md`](../CLAUDE.md) for implementation rules.

## Working product

CRB currently runs as a local TypeScript/Vite frontend with a Node HTTP backend.

### Applicant

- Photo landing page with demo credentials and one-click completed demo.
- Six left-navigation stages: Job Opportunity, Self-assessment, Part 1 Interview, Generate Initial Profile, Part 2 Feedback and Follow-up, Full Resume.
- Optional Profile tab with direct fields and reviewed resume import.
- Public job URL, document and pasted-description input.
- Editable AI opportunity analysis distinguishing stated requirements and interpretations.
- Approximately eight generated questions.
- Typed answers or browser audio recording/upload/transcription.
- Incremental transcription commit and retry after partial failure.
- Initial and updated resume/candidate-profile generation.
- Green, amber, blue and grey evidence coverage with an on-screen legend.
- Applicant-approved material preview for the in-tab company view.

### Company

- Company login and direct one-click company demo.
- Three fictional candidates ordered alphabetically against the same SUTD role.
- Colour-coded coverage, requirement excerpts, gaps and suggested interview questions.
- Explained human assessment controls.
- No score-based ordering, automatic rejection or hiring recommendation.

### Original interview engine

`/interview` remains because the CRB shell reuses its fields, recording, transcription, artifact rendering and export handlers. It is an implementation dependency and regression surface, even though its older preset entry points are hidden in the main CRB applicant flow.

## Demo versus live behaviour

| Area | Demo fixture | Live behaviour |
| --- | --- | --- |
| Completed applicant | Daniel Tan record in `src/applicant-demo.ts` | A user can enter a real opportunity and evidence. |
| Company board | Three records in `src/company-demo.ts` | One approved applicant snapshot can be reviewed within the same tab. |
| Evidence charts | Fixture classifications are editable | General AI generation returns profiles, but a persisted requirement/evidence graph is not implemented. |
| Job extraction | SUTD fixture is preloaded | Public URL/document extraction calls the backend. |
| Questions and artifacts | Completed outputs are preloaded | Buttons call configured AI providers. |
| Accounts | Visible demo names/passwords | No real authentication exists. |
| Storage | Source-controlled fixtures and browser memory | No database or durable session recovery exists. |

Do not describe the three-candidate board as data produced by three real applicant accounts.

## Decisions already made

- CRB is intended for general job seekers rather than a 42 Projects audience.
- The applicant flow should not feel laborious or fatigue-inducing.
- Profile/contact entry sits outside the numbered practice flow.
- Typed self-assessment and recorded interviews coexist.
- Evidence coverage is transparent and traceable, not an opaque fit score.
- Company candidates are alphabetically ordered in the demo.
- Private practice material requires applicant approval before company access.
- Missing evidence is not inability.
- Unsupported claims stay out of resumes.
- The current build is local; cloud accounts/storage are a later production phase.

## Technical safeguards already implemented

- Successful transcript segments survive later batch failure.
- Retries target missing transcription items.
- Server binds to loopback and checks same-origin request metadata.
- Job fetching rejects private/special-purpose destinations and revalidates redirects.
- DNS resolution is pinned for outbound fetching.
- Evidence isolation excludes interviewer, unknown-speaker and generated-draft text.
- Speaker labels are not guessed from punctuation.
- AI responses receive nested runtime type/value validation.
- Resume import is reviewed before filling empty fields.
- Current dependency versions and the lockfile are checked in.

See [`REVIEW_FIXES.md`](REVIEW_FIXES.md) for details.

## Known limitations

- Browser refresh or closure loses undownloaded work.
- There is no real user, organisation or application database.
- There is no cross-device or cross-user sharing.
- Two-hour cloud recording, resumable upload and recovery are not implemented in this CRB branch.
- Provider and microphone accuracy are not established by mocked tests.
- Evidence source presence does not establish factual truth or semantic correctness.
- Job pages that block automation require paste or upload fallback.
- Voice-signature identification is not implemented and would require biometric-data review.
- Formal accessibility, bias, disparate-impact and fatigue studies have not been completed.

## Recommended next implementation phase

Build durable applicant sessions before a real employer board:

1. Define versioned `Opportunity`, `InterviewSession`, `TranscriptSegment`, `EvidenceItem`, `Artifact` and `ApprovedSnapshot` records.
2. Save completed recording segments without interrupting microphone capture.
3. Restore interrupted sessions and visibly identify missing audio/transcript ranges.
4. Preserve immutable source excerpts and user corrections.
5. Add actual authentication and role-scoped authorization before connecting separate users.
6. Populate company cards only from applicant-approved snapshots.

Production architecture is described in [`../README.md`](../README.md#production-architecture-required).

## Verification baseline

At this handover:

- 48 Node regression tests pass.
- 18 Playwright browser tests pass.
- TypeScript checking passes.
- The Vite production build passes.
- Backend syntax validation passes.
- `.env`, recordings, exports, build output and test reports are ignored.

Run:

```sh
npm run check
npm run test:browser
```

## Repository status

Work remains on `feat/crb-six-step-design`. It has not been merged, deployed, published or pushed as part of this handover. Review the complete diff and create coherent commits before sharing the branch.
