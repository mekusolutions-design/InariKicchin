# Production Readiness Checklist
**Updated:** 9 November 2026

| Criterion | Status |
|----------|--------|
| Supabase migrations + seed | PASS |
| Persistent auth | PASS (Supabase) |
| Durable business routes | PASS (matrix) |
| POS frontend contract | PASS (fixed) |
| Sales CSV / analytics / eTIMS | PASS |
| Concurrent receipts + POS idempotency | PASS (Supabase) |
| Unit/schema tests | PASS (54) |
| Next.js production build | PASS |
| Production refuses memory-only | PASS (DATABASE_URL required) |
| Staging boots without DURABLE_CONFIRMED | PASS (gate fix) |
| Render serving this build | **PENDING redeploy** |
| Render /health /ready | **PENDING** |
| Netlify E2E against Render | **PENDING** |
| INARI_DURABLE_CONFIRMED=1 | **NO** |

## Recommendation

**GO — redeploy Render staging with this package.**

**NO-GO for production** until:
1. Render serves `/health` and `/ready` with `storage: postgresql`
2. Smoke: login → product/supplier → purchase → POS → kitchen → reports/CSV
3. Netlify frontend works against Render
4. Then set `INARI_DURABLE_CONFIRMED=1` and restart

### Render env (exact names)

- `DATABASE_URL` (pooler)
- `DIRECT_URL` (direct)
- `INARI_TOKEN_SECRET` (≥32 chars)
- `CORS_ORIGINS` (Netlify origin)
- `NODE_ENV=production`
- Leave `INARI_DURABLE_CONFIRMED` unset until smoke passes
