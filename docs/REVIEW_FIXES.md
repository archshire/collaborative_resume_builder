# Repository review and fixes

Branch: `fix/interview-integrity-security`

All six reported issues were confirmed against the original checkout. No earlier evaluation document was supplied; this review verified the findings listed in the request against the code.

| Finding | Confirmed behavior and fix |
| --- | --- |
| Partial transcription data loss | Files were marked transcribed before the batch's text was saved. Each validated result now commits before its completion flag is set. Later failures retain earlier text, and retries skip saved files. Overlapping batches in the same interview part are prevented. |
| Unrestricted backend access and job URL fetching | Backend and Vite exposed all interfaces; endpoints lacked origin checks and URLs could reach internal services. They now bind to loopback. Host/Origin/fetch-metadata checks and JSON plus a non-simple header restrict browser access. Every URL/redirect resolves only public IPv4/IPv6 addresses, pinned to the socket to prevent DNS rebinding. Private/reserved/mapped addresses, credentials, unusual ports, unsupported content types, oversized pages, and malformed/excess redirects are rejected. DNS/page time is bounded. Request JSON is size-limited; static paths use a directory boundary check. |
| Unreliable evidence filtering | Long text bypassed checks; technology substring matching and a global word blacklist caused false results. Multiline/direct fields could disappear, and generated resumes entered transcript evidence. The backend now isolates explicit applicant turns and separately typed direct information, excluding unknown speakers, interviewer turns, and generated drafts. The readiness heuristic has no long-text bypass, technology substring matching, or global blacklist. Nontechnical examples and direct-info-only use are retained. |
| Guessed speaker attribution | Punctuation assigned questions to interviewers and statements to applicants; Speaker 2 counted as the applicant. Formatting now preserves uncertain/unlabelled text and normalizes only explicit roles. Providers are instructed not to infer roles from punctuation. Both editors show role-review guidance. |
| Shallow AI validation | Truthy fields, coerced objects, arbitrary nested values, and invalid scores could reach rendering. Mode-specific schemas now enforce string/array bounds, nested types, finite 0–100 scores, question/card counts, and complete source quotes for profile evidence. Positive scores require quotes. Job extraction and interview questions are validated too. Invalid provider output triggers fallback, then 502 if all providers fail. |
| Outdated dependencies | Vite 2.9.16 and TypeScript 4.9.5 were outdated; the original npm audit reported five affected packages (four high, one moderate). Updated to registry-current Vite 8.2.2 and TypeScript 7.0.2, regenerated the lockfile, required Node.js 24+, and added bundler resolution/Vite CSS types. Added ipaddr.js 2.5.0 for IP classification and Playwright 1.63.0 for browser tests. |

Runtime/build guidance: [Vite](https://vite.dev/guide/) and [TypeScript](https://www.typescriptlang.org/download/). Exact versions were checked against npm registry metadata, and advisories using `npm audit`.

## Verification

- Node.js 24.20.0, temporarily installed outside the repository; archive matched the official SHA-256 manifest.
- 29 Node regression tests covering transcript recovery, evidence isolation, schemas, real local HTTP routing with mocked providers, fallback, and URL security.
- Four Chromium tests covering partial failures/retries in both parts, manual edits, Part 1 → Part 2 generation, direct information, and real same-origin backend access.
- TypeScript checking, Vite production build, backend syntax, and `git diff --check`.
- Clean installation and audit results are recorded in the final task report.

## Remaining limitations

- This is a single-user local prototype. Local processes are trusted; the custom header is a browser-origin defense, not a password. There is no multi-user authentication or public-hosting support. Exposing it through a reverse proxy requires separate authentication and authorization.
- Audio, transcripts, and artifacts remain in browser memory. Successful chunks survive batch failures, but reloads/tab closure/browser crashes still lose undownloaded session data. Download recordings and transcripts during long interviews.
- Speaker identity depends on provider output and human review. Unknown speakers are excluded until corrected. Multiline text after an explicit label remains part of that turn until another label or section boundary.
- The readiness check is a conservative language heuristic, not a truth/relevance verifier. Unusual phrasing/languages may need editing or direct information. Direct information is self-reported. Prompt instructions still handle jokes, negation, irrelevant statements, and unsupported assertions within accepted sources.
- Exact quotes and schemas do not prove that a quote supports the model's label, score, or interpretation. Free-form resume/profile prose, factual truth, and prompt-injection resistance require human review. Strict quotes can reject useful paraphrases and trigger fallback.
- Browser tests use controlled transcription/artifact responses; provider tests mock network calls. Real model availability/quota, audio accuracy, physical microphone behavior, and print-dialog output were not tested with live providers or personal recordings.
- Some public websites block automated extraction or require JavaScript. Nonstandard ports and private destinations are intentionally unsupported; manual paste remains available.

No merge or deployment was performed.
