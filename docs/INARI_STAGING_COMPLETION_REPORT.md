# InariKicchin Staging Completion Report
**Date:** 9 November 2026 (final package)

## Summary

Supabase staging is migrated and seeded. API is PostgreSQL-backed for all major business routes when `DATABASE_URL` is set. Production startup gate fixed so Render can boot with only `DATABASE_URL` (not `INARI_DURABLE_CONFIRMED`).

POS response shape aligned to frontend (`{ order, ticket }` with `grandTotal`). Concurrent stock receipt and POS idempotency tests pass against live Supabase. Next.js production build succeeds.

**Render HTTP still returns 404** until this package is redeployed with correct env var names.

## Completed in this package

| Item | Status |
|------|--------|
| Render gate fix (DATABASE_URL only required to start) | Done |
| POS frontend contract (`order`/`ticket`/`grandTotal`/`deliveryRef`) | Done |
| Concurrency tests (5 parallel receipts; 4 parallel idempotent POS) | Pass on Supabase |
| Integration tests (auth, stock, POS, reads) | Pass on Supabase (4) |
| Unit/schema tests | Pass (54) |
| Next.js production build | Pass |
| Sales CSV / supplier analytics / eTIMS durable | Done (prior) |
| Catalog POST products/suppliers | Done (prior) |

## Offline queue

Frontend has **no offline queue client**. Server-side POS uses `IdempotencyRecord` + unique `idempotency_key` on orders. Concurrent same-key POS creates exactly one order (verified). Sufficient for current UI contract.

## Admin CRUD

Frontend only lists products/suppliers and POSTs purchases. Closing page is read-only history. No product/supplier/menu update UI exists — create endpoints provided; update endpoints not required by current frontend.

## Files changed (key)

- `apps/api/src/production-server.ts` — gate + route wiring
- `apps/api/src/infrastructure/repositories/order-repository.ts` — frontend response shape
- `apps/api/src/infrastructure/repositories/concurrency.node-test.ts` — new
- `apps/api/src/infrastructure/repositories/integration.node-test.ts`
- `apps/api/prisma/seed.ts` — pooler-safe
- `docs/RENDER_STAGING_DEPLOY.md`

## Operator action required

1. Deploy this zip to Render staging service.
2. Set env: `DATABASE_URL`, `DIRECT_URL`, `INARI_TOKEN_SECRET`, `CORS_ORIGINS` (exact names).
3. Do **not** set `INARI_DURABLE_CONFIRMED=1` until smoke passes.
4. Verify `/health`, `/ready`, login, purchase, POS, reports.
5. Point Netlify `NEXT_PUBLIC_API_URL` at Render URL if needed.
