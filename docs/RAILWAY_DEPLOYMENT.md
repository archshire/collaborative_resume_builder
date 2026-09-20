# Deploying CRB to Railway

This guide deploys the protected demonstration. It does not add durable applicant accounts, a database or permanent recording storage.

## Before deployment

Confirm that the deployment branch passes:

```sh
npm ci
npm run check
npm run test:browser
```

Never commit `.env`. Railway variables belong in the Railway dashboard.

## Create the service

1. Accept the Railway workspace invitation while signed into the intended account.
2. Choose **New → GitHub Repository** in the project canvas.
3. Connect `archshire/collaborative_resume_builder`.
4. Select `feat/crb-applicant-company-demo` as the deployment branch during review.
5. Confirm the build and start commands below.

| Setting | Value | Source |
| --- | --- | --- |
| Builder | Railpack | Railpack auto-detection |
| Build | `npm run build` | `package.json` |
| Start | `npm run serve` | [`railpack.json`](../railpack.json) and the `start` script |
| Health check | `/health` | Service settings only |
| Restart policy | On failure | Service settings only |

### Why the start command lives in `railpack.json`

Railpack detects `vite build` in the build script and will otherwise deploy CRB as a **static
site**, serving `dist/` with no Node process. Every `/api/*` path then returns the SPA page, all AI
features stop working, and the outer password gate has no server to enforce it.

Two repository-level settings prevent that, and neither needs dashboard access:

- [`railpack.json`](../railpack.json) sets `deploy.startCommand`.
- `package.json` defines a `start` script; an explicit start script suppresses Railpack's
  single-page-application mode.

[`railway.toml`](../railway.toml) is **not** read unless the service has a Config-as-code file path
set. Railway deprecated Config as Code, and services that never used it can no longer opt in, so
treat `railway.toml` as a record of intent rather than applied configuration. Health check and
restart policy can only be set in the service settings.

If a deployment ever serves the built files without the backend, the application refuses to open
and shows "Demonstration unavailable" rather than exposing the demo without a password.

## Add variables

Under the service **Variables** tab, add:

| Variable | Required | Purpose |
| --- | --- | --- |
| `OPENAI_API_KEY` | Yes for live AI | Server-side provider key. |
| `DEMO_ACCESS_PASSWORD` | Yes on Railway | Outer private-demo password. Use a long unique value. |
| `AI_RATE_LIMIT` | Recommended | Paid calls per authenticated session per ten-minute window. Default: `30`. |
| `NODE_ENV` | Recommended | Set to `production`. |
| `OPENAI_TEXT_MODEL` | Optional | Override the default text model. |
| `OPENAI_TRANSCRIBE_MODEL` | Optional | Override the default transcription model. |
| `PUBLIC_APP_URL` | Custom domains only | Exact HTTPS origin, such as `https://crb.example.com`. Railway's generated domain is detected automatically. |

Do not define `PORT`; Railway injects it. Railway deployments refuse to start without `DEMO_ACCESS_PASSWORD`.

## Enable networking

1. Open **Settings → Networking** and generate a Railway domain.
2. Confirm that the target port uses the service `PORT`.
3. Open `/health`; it should return `{"status":"ok"}`.
4. Open `/applicant`; the private access gate should appear before the normal landing page.

For a custom domain, set `PUBLIC_APP_URL` to its exact `https://` origin and redeploy.

## Deployment checks

After entering the outer password, verify applicant and company demos, job extraction, question/artifact generation, resume import, a short recording/transcription, evidence legends and company assessments. Confirm that an incorrect password is rejected and excess paid calls receive a visible rate-limit error.

## Operational limitations

- The outer cookie lasts eight hours and resets when the service restarts.
- Rate limits live in process memory and reset on restart. They are a demo safeguard, not a production quota system.
- Workspace answers live in browser memory and are lost on refresh or tab closure.
- Railway's ordinary service filesystem is ephemeral; CRB does not persist uploads there.
- One-click candidates are fictional fixtures.
- There is no multi-user authorization or permanent applicant-to-company sharing.

Monitor Railway logs and OpenAI usage. Rotate either secret immediately if it may have been exposed.

## Updating the deployment

Railway can deploy commits from the connected branch. Keep automatic deployment disabled during active experimentation, or configure Railway to wait for repository CI. Review the deployment diff and checks before promoting a new version.
