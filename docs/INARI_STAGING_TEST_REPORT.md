# InariKicchin Staging Test Report
**Date:** 9 November 2026

## Local / unit

```
npm run test -w @inari/api
→ 47 domain tests pass (includes 2 production-gate tests)
→ 7 schema-contract tests pass
→ 54 total
```

## Supabase staging (DIRECT_URL)

```
node --import tsx --test \
  src/infrastructure/repositories/integration.node-test.ts \
  src/infrastructure/repositories/concurrency.node-test.ts
```

| Test | Result |
|------|--------|
| persistent login/logout | PASS |
| receive stock + WAC | PASS |
| POS + kitchen + void + idempotency | PASS |
| read dashboard/products | PASS |
| concurrent stock receipts (5 workers) | PASS |
| concurrent POS same idempotency key (4 workers) | PASS |

**6/6 pass** against live Supabase.

## Frontend

```
npm run build -w @inari/web
→ Compiled successfully; 16 routes generated
```

## Render deployed API

```
curl https://inarikicchin.onrender.com/health → HTTP 404 (service not running this package yet)
curl https://inarikicchin.onrender.com/ready  → HTTP 404
```

Redeploy required with this build + correct env vars.

## Netlify browser E2E

Not executed (Render not serving this build). After redeploy: login, dashboard, inventory-received, POS, kitchen, reports.
