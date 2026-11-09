# Render Staging Deploy Guide
**Fix applied:** production startup no longer requires `INARI_DURABLE_CONFIRMED=1` to boot.
It only requires `DATABASE_URL` so the process cannot start in memory-only mode.

## Required Render environment variables

| Variable | Required | Notes |
|----------|----------|-------|
| `DATABASE_URL` | **Yes** | Supabase **pooler** URL (`…pooler.supabase.com:6543/…?pgbouncer=true`) |
| `DIRECT_URL` | **Yes** | Supabase **direct** URL (`…:5432/…`) for migrations if run from CI |
| `INARI_TOKEN_SECRET` | **Yes** | ≥ 32 random characters (do not reuse JWT_SECRET name unless you also map it in code) |
| `CORS_ORIGINS` | **Yes** | e.g. `https://inarikicchin.netlify.app,http://localhost:8082` (comma-separated, no spaces or with trim) |
| `NODE_ENV` | Yes | `production` |
| `PORT` | Auto | Render sets this |
| `INARI_DURABLE_CONFIRMED` | **No for boot** | Set to `1` only **after** staging smoke tests pass |

### Name mapping from your `.env` file

If Render currently has:
- `CORS_ORIGIN` → also set **`CORS_ORIGINS`** (code reads `CORS_ORIGINS`)
- `JWT_SECRET` → also set **`INARI_TOKEN_SECRET`** (code reads `INARI_TOKEN_SECRET`)

## Build / start commands

Root of monorepo:

```text
Build:  npm install
Start:  npm run start:prod -w @inari/api
```

Node version: **22** (see `.nvmrc`).

## After deploy — smoke checklist

```bash
curl -sS https://<your-render-host>/health
curl -sS https://<your-render-host>/ready
# expect ready:true, storage:postgresql

curl -sS -X POST https://<your-render-host>/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"<bootstrap-admin>","password":"<bootstrap-password>"}'
```

Then exercise: products, suppliers, purchases, POS, kitchen, closings, reports/sales.csv.

Only after that succeeds, set on Render:

```text
INARI_DURABLE_CONFIRMED=1
```

and restart the service.

## What this fix changes in code

`apps/api/src/production-server.ts` production gate:

- **Before:** required `DATABASE_URL` **and** `INARI_DURABLE_CONFIRMED=1` → staging could never start for verification.
- **After:** requires only `DATABASE_URL` in production. Confirm flag is reported by `/ready` only.

## Do not

- Set `INARI_DURABLE_CONFIRMED=1` just to make the process start.
- Deploy to a production service.
- Commit secrets.
