# Gap-fixes test report & code review

**Date:** 2026-11-10  
**Scope:** Stabilisation / screen-by-screen gap work + regression suite

## Automated tests

Command (no live Postgres required):

```bash
cd apps/api
node --experimental-strip-types --test \
  src/domain/vat/calculations.node-test.ts \
  src/domain/stock/calculations.node-test.ts \
  src/domain/stock/units.node-test.ts \
  src/domain/auth.node-test.ts \
  src/domain/phase4.node-test.ts \
  src/domain/store.node-test.ts \
  src/gap-fixes.node-test.ts \
  src/infrastructure/database.node-test.ts \
  src/prisma-schema.node-test.mjs
```

**Result: 69 tests, 23 suites, 0 failures**

New file: `apps/api/src/gap-fixes.node-test.ts` covers:

- Kitchen transition matrix + idempotent finals (SERVED→SERVED)
- Closing itemType normalisation (PRODUCT / MAKELINE)
- VAT disabled / inclusive / exclusive
- Wastage reason + stock bounds
- Phase 4 recipe deduction
- Role permission matrix (pos, settings, kitchen, void, closing, wastage)
- Role home paths
- Order void → CANCELLED
- Delivery platform reference requirement

Also registered in `apps/api/package.json` → `test:domain`.

### Not run in this environment

| Suite | Reason |
|-------|--------|
| Integration / concurrency Prisma tests | Require live `DATABASE_URL` |
| Next.js web build / Playwright E2E | No full frontend install + browser |
| Live Render / Netlify smoke | External credentials |

## Code review (gap work)

### Strengths

- Durable order create reads Settings VAT + module flags in one transaction
- Kitchen status updates are idempotent on terminal states
- Closing route defaults period to Africa/Nairobi and normalises itemType
- Wastage + recipe deduction create proper stock movements + audit
- Role-gated nav matches backend permission intent for cashiers/kitchen
- Void requires reason + manager PIN (admin exception)

### Risks / residual notes

1. **Demo `InariStore.updateTicketStatus`** still accepts any status; enforcement is durable-only. Acceptable if production always uses Postgres.
2. **Recipe deduction idempotency keys** include `Date.now()` — fine for audit trails; concurrent double-submit of production relies on app UX, not a unique business key.
3. **Frontend `getStoredUser()` during render** on POS reports is client-only; SSR-safe because pages are `"use client"`.
4. **DELETE /recipes** needs CORS DELETE (added). Confirm reverse proxies allow it.
5. **Integration tests** should still be run against staging Postgres after migrate deploy.

### Production checklist before go-live

1. `prisma migrate deploy` + seed
2. Set `DATABASE_URL`, `INARI_TOKEN_SECRET` (≥32 chars), `INARI_DURABLE_CONFIRMED=1` if required by gate
3. Smoke: login roles, POS, void+PIN, wastage, closing, makeline recipe ON, settings save, kitchen SERVED twice
