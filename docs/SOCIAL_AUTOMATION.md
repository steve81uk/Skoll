# Social Automation (Cheapest + Easiest)

This project can emit alert payloads from either:
- frontend runtime (`/api/alerts/social-relay`), or
- backend headless mode (`AUTO_RELAY_ENABLED=true`) for Docker/GitHub/server use.

## 1. Recommended Low-Cost Pipeline

Use one relay webhook target (Make.com, n8n, Pipedream, or Zapier).
That workflow can then branch to social destinations.

Suggested stack:
- `Skoll backend -> Webhook relay -> formatter -> social connector`

## 2. Backend Env Vars

Add to your `.env` or container env:

```env
SOCIAL_RELAY_WEBHOOK=https://your-automation-webhook-url
AUTO_RELAY_ENABLED=true
```

Notes:
- `SOCIAL_RELAY_WEBHOOK` is required for relay.
- `AUTO_RELAY_ENABLED=true` enables periodic backend-only alert emission.

## 3. Webhook Payload Shape

Frontend and backend emit compatible JSON payloads with alert list.

Example fields:
- `source`
- `timestamp`
- `alerts[]` with `id`, `severity`, `message`, `ts`, `value`

Backend headless mode also includes:
- `mode: headless-auto-relay`
- current solar-wind `reading`

## 4. Platform Notes

- X.com: generally the easiest API-supported destination.
- Instagram: usually requires Meta app setup/business flow.
- TikTok: API access is more constrained by account/app approval.

Cheapest practical route is:
1. send all alerts to X automatically,
2. optionally mirror selected high-severity alerts to Insta/TikTok via approved workflow steps.

## 5. Docker / GitHub Actions

- Docker: pass env vars to container and keep backend running.
- GitHub Actions: run backend poll job on schedule if you want periodic posting without dedicated server.

## 6. Safety

- Backend relay uses cooldown logic to reduce spam.
- Keep webhook secrets out of git; store in env/secret managers.

## 7. Import-Ready Templates

Template files added:
- `docs/workflows/n8n-skoll-social-relay.json`
- `docs/workflows/make-skoll-social-relay.json`

Import notes:
- n8n: `Workflows -> Import from file`.
- Make: `Scenarios -> Import Blueprint`.

Both templates assume your backend sends relay payloads to the automation webhook from:
- `POST /api/alerts/social-relay`

Direct X relay is also available from backend:
- `POST /api/alerts/x-relay`
- `POST /api/alerts/x-relay/test`

Required env vars for direct X posting:
- `X_RELAY_ENABLED=true`
- `X_BEARER_TOKEN=...`

Severity routing defaults:
- X: all alerts.
- Instagram + TikTok: critical alerts.
