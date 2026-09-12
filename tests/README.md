# Regression checks

Requires Node.js 24 or newer.

```sh
npm ci
npm run check
npx playwright install chromium
npm run test:browser
npm audit
```

`npm run check` runs 48 Node tests, TypeScript checking, the Vite production build, and the backend syntax check. Tests start a temporary loopback HTTP server; restricted environments need permission for local listening. No real provider keys or paid AI calls are required. Provider responses are mocked.

- `transcription.test.ts`: incremental saves, partial failure/retry, malformed success responses, failed editor commits.
- `evidence.test.cjs`: explicit/unknown roles, multiline turns, direct information, nontechnical examples, transcript/draft separation, formatting without speaker guesses.
- `validation.test.cjs`: nested payload types, bounds, scores, source quotes, job extraction and question contracts.
- `security.test.cjs`: local access, IPv4/IPv6, DNS pinning, redirects, URL encodings, response limits.
- `backend.test.cjs`: HTTP routing, request rejection, evidence gate, provider fallback, direct-info-only usage, invalid provider output.
- `demo-access.test.ts`: demo credentials, approved snapshot whitelisting, and explicit applicant speaker filtering.
- `opportunity.test.cjs`: requirement types, interpretation labels and exact source quotes.
- `reflection.test.cjs`: source-excerpt fidelity and malformed output rejection.
- `browser/native-shell.spec.ts`: nine tests for the completed applicant and three-candidate company demos, evidence legends, photo landing separation, six-step navigation, field preservation, actual URL/paste request wiring, privacy, failure recovery, asynchronous edit preservation, and mobile layouts.
- `response-formats.test.cjs`: constrained source quotes, multiline enum safety, question cardinality and profile schema fields.
- `browser/buttons.spec.ts`: document imports, answer organisation, both generation stages, clipboard, downloads, PDF preview, sharing/withdrawal, logout/reset, and synthetic microphone/recording controls.
- `browser/workflow.spec.ts`: four Chromium tests for partial transcription failures in both parts, edits/retries, two-part generation, separate direct information, and same-origin access.

The 18 browser tests cover the CRB demo and original `/interview` workflow. Browser tests build the app and start an isolated server on port 4189 without provider keys. They do not reuse a personal session. Reports/results are ignored by Git. Set `PLAYWRIGHT_BROWSERS_PATH` for an alternative browser installation directory.

The earlier manual checklist was historical, not automated coverage. This suite does not claim to test real microphone accuracy, live model behavior, or print-dialog output. See [review findings and limitations](../docs/REVIEW_FIXES.md).

Resume import coverage: `resume-import.test.cjs`, backend endpoint tests, and `browser/resume-import.spec.ts` verify upload validation, source fidelity for text, explicit review, existing-field preservation and mobile layout.
