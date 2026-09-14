# CRB button audit — updated 13 September 2026

Branch: `feat/crb-six-step-design`. No merge or deployment.

## Changes

- Removed the second extraction action. Use Extract for a URL/upload, or paste a description directly and use role analysis/questions.
- Added strict OpenAI response formats for role analysis, interview questions, answer organisation and document generation. Existing semantic and source validators remain active.
- Role/reflection/profile excerpt choices come from actual submitted source sentences. Multiline/control-character literals are excluded from schema enum values because the live API rejected them. This does not remove text from the source description.
- Role-analysis failures include bounded, credential-redacted details instead of incorrectly blaming configuration for every failure.
- Answer edits made while AI organisation runs now receive a useful status message. Role-analysis button disabled state is restored correctly if the job description is cleared during a request.

## Checked controls

| Area | Verification |
|---|---|
| Applicant/company login, account tabs, six sidebar steps, Back/Continue, logout, new session | Browser tests; session reset requires accepting the browser unsaved-work prompt |
| URL Extract | Live supplied SUTD URL; browser failure/edit-race regression |
| Job upload + Extract | Browser file chooser and extraction using text fixture |
| Understand the role; generated questions | Live SUTD description and browser regressions |
| Typed answer, organise answer, append to transcript | Live fictional answer and browser regressions |
| Interviewer toggle and optional applicant fields | Browser tests with navigation retention |
| Check mic, record, pause/resume, stop, recording download | Synthetic Chromium microphone in both interview stages |
| Recording transcription, file upload/transcription/removal | Controlled provider responses; partial failure/retry regressions |
| Supporting document upload and transcript downloads | Browser tests |
| Resume and candidate profile generation; both follow-up versions | Live OpenAI requests with fictional applicant evidence; browser regressions |
| Copy, candidate/feedback downloads, initial/final PDF | Clipboard reads and completed browser downloads; PDF preview content checked (OS print dialog not automated) |
| Application preview, approve, withdraw; company rubric and save rationale | Browser tests; private interviewer content excluded |

53 backend/unit tests pass; 18 Chromium tests pass; TypeScript, production build and backend syntax pass.

The native demo intentionally hides the original numerical skill-score panels. Their legacy generation controls are covered on `/interview` by existing tests. Browser recording checks do not verify physical hardware, real speech recognition accuracy, or OS print-dialog behavior. The audit does not establish that all possible job sites, files or future model responses will succeed. Original user inputs remain reviewable.
