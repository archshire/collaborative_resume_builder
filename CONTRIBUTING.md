# Contributing to CRB

Thank you for helping develop Collaborative Resume (Contribution) Builder. Start with [`README.md`](README.md) for the product and architecture, [`CLAUDE.md`](CLAUDE.md) for implementation invariants, and [`docs/CURRENT_STATE.md`](docs/CURRENT_STATE.md) for the handover state.

## Local setup

CRB requires Node.js 24 or newer.

```sh
npm ci
cp .env.example .env
npm run build
npm run serve
```

Add your own provider key to `.env`. Never commit that file.

Local routes:

- Applicant: `http://localhost:4173/applicant`
- Company: `http://localhost:4173/company`
- Original interview engine: `http://localhost:4173/interview`

## Branches and commits

- Create a focused branch from the agreed base branch.
- Keep unrelated refactors out of feature changes.
- Use small commits with messages describing the resulting behaviour.
- Do not commit `dist/`, `node_modules/`, `.env`, recordings, exports, Playwright reports or test results.
- Do not merge, push, deploy or publish without the repository owner's instruction.

Before committing, review:

```sh
git status --short
git diff --check
git diff
```

## Product-change workflow

For new product phases, agree on the user flow, key wording and acceptance criteria before implementation. Once approved, make routine technical decisions without repeatedly interrupting the work.

Preserve these principles:

- low applicant effort and minimal fatigue;
- opportunity-first reflection;
- evidence before claims;
- applicant correction and approval;
- transparent employer review; and
- no automatic rejection or opaque ranking.

## Changing AI contracts

An AI response-format change normally requires coordinated updates to:

1. the provider schema in `server/response-formats.cjs`;
2. runtime validation in `server/validation.cjs` or the relevant domain module;
3. the prompt and request in `server/index.cjs`;
4. frontend rendering in `src/main.ts` or `src/native-shell.ts`;
5. malformed-response, fallback and source-fidelity tests; and
6. documentation if user-visible meaning changes.

Do not rely on TypeScript types for network data. Runtime validation is required. Keep field lengths, array cardinality, numeric ranges and nested values bounded.

## Changing evidence logic

Evidence changes require examples covering:

- explicit applicant labels;
- interviewer and unknown-speaker exclusion;
- multiline applicant turns;
- negation and uncertainty;
- self-reported capability without an example;
- relevant nontechnical experience;
- direct profile information; and
- separation of generated drafts from source evidence.

Do not solve relevance problems with a global keyword blacklist or accept long text merely because it is long.

## Changing demo data

Demo data must be fictional and visibly labelled. When editing a candidate, keep these aligned:

- job requirement;
- interview excerpt;
- evidence state;
- coverage calculation;
- profile summary;
- resume claim;
- remaining gap; and
- follow-up answer.

Candidate ordering in the company demo is alphabetical. Do not sort by coverage. Use `.example.com` addresses and clearly fictional identifiers.

## Testing

Run Node tests and the production build:

```sh
npm run check
```

Run browser workflows:

```sh
npx playwright install chromium
npm run test:browser
```

Provider calls are mocked in automated tests, so tests should not spend API credits or depend on a contributor's `.env`.

Use the smallest relevant check during development, then run the full checks before handover. See [`tests/README.md`](tests/README.md) for test ownership.

## Pull-request checklist

- [ ] The PR describes the user-visible problem and resulting behaviour.
- [ ] Applicant/company/demo/production scope is explicit.
- [ ] Evidence and privacy boundaries are preserved.
- [ ] New AI fields have strict runtime validation.
- [ ] Failure and retry behaviour preserves user data.
- [ ] Relevant regression tests were added or updated.
- [ ] `npm run check` passes.
- [ ] `npm run test:browser` passes.
- [ ] Documentation reflects the final implementation.
- [ ] No secret or generated personal artifact is included.

## Review priorities

Review changes in this order:

1. data loss and recovery;
2. access control and private-data exposure;
3. unsupported or misleading candidate claims;
4. applicant effort and clarity;
5. failure behaviour and observability;
6. accessibility and responsive layout; and
7. maintainability.
