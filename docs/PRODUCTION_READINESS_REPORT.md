# Inari Kicchin — Production Readiness Assessment

**Assessment date:** 9 November 2026  
**Source archive:** `InariKicchin-QA-Verified.zip`  
**Business reference:** Restaurant Management System Blueprint v1.0 (6 November 2026)

## Executive decision: NO-GO for live restaurant operations

This archive is a useful tested functional prototype, but it is not a production-ready restaurant management system. The most consequential defect is architectural: `apps/api/src/production-server.ts` constructs `seedDemoStore()` and routes all business operations to that in-memory object. Restarting or replacing the process loses the mutations. The Prisma schema exists but is not connected to the HTTP server through repositories/services.

The schema is also incomplete relative to the running domain: it currently defines users, audit, settings, units, products, suppliers, purchases, stock operations, closings, menu and recipe lines, but does not define durable order/order-line/payment/kitchen-ticket records. A production persistence implementation cannot be considered complete without these and other workflow records being modelled and transactionally connected.

## Work applied to this release candidate

1. Added a hard production-startup guard to `production-server.ts`. With `NODE_ENV=production`, the in-memory server now refuses to start and explains why. This intentionally prevents accidental use as a live system.
2. Required `INARI_TOKEN_SECRET` for local API startup and enforce a minimum length of 32 characters.
3. Replaced wildcard CORS with an explicit `CORS_ORIGINS` allowlist.
4. Added a 1 MiB request-body limit and clearer malformed-JSON handling.
5. Added basic HTTP timeout settings and security/cache headers.
6. Changed `/ready` to return HTTP 503 and explicitly report non-durable in-memory storage.
7. Added Netlify build configuration for the Next.js frontend and Node 22 pinning.
8. Added `.gitignore` and separated local API/web environment templates.
9. Added this report and a detailed production-readiness master prompt.

No costing, stock, VAT or order business formulas were changed.

## Verification performed

### Automated domain tests

Command:

```bash
cd apps/api
node --experimental-strip-types --test \
  src/domain/stock/calculations.node-test.ts \
  src/domain/stock/units.node-test.ts \
  src/domain/vat/calculations.node-test.ts \
  src/domain/store.node-test.ts \
  src/domain/phase4.node-test.ts \
  src/domain/auth.node-test.ts
```

Result: **42 tests passed, 0 failed** on Node.js v22.16.0.

These are domain-level tests. They do not establish database persistence, production API integration, frontend build success or live deployment readiness.

### Not verified

- Next.js production build: dependencies were not installed in this execution environment; no successful build is claimed.
- Prisma client generation, migrations or database connectivity: not implemented/verified.
- Production API startup: intentionally blocked by the new safety gate.
- Netlify/Render account deployment, live URL and environment variables: not accessible from this archive review.
- Browser end-to-end tests and backup/restore drill: not run.

## Critical blockers before GO-LIVE

| Priority | Finding | Required closure evidence |
|---|---|---|
| Critical | API data is in-memory; mutations are lost on process restart | Prisma-backed repositories for all business entities; integration test proving persistence across restart |
| Critical | Prisma schema lacks durable sales/order/payment/kitchen ticket models | Reviewed schema + migrations + FK/unique constraints + tests |
| Critical | Production administrator provisioning is demo-seed oriented | Secure one-time owner bootstrap; no known default credentials; verified password reset/rotation |
| Critical | Sessions and login lockout are process-local | Durable/shared session and throttling design suitable for multiple instances |
| High | No request schema validation across API mutations | Runtime validation and negative tests for every mutation |
| High | No durable idempotency constraints | Database-backed idempotency keys and concurrency tests |
| High | Frontend bearer token stored in localStorage | Security review and preferably HttpOnly/SameSite cookie session architecture with CSRF controls |
| High | No complete migration/backup/restore evidence | Versioned migrations, automated backups and successful restore drill |
| High | No API rate limiting by IP/shared store | Production rate limiting and abuse tests |
| Medium | Closing Stock interactive count grid missing | Blueprint §14.5 and UAT acceptance |
| Medium | PDF/Excel report exports incomplete | Implement and verify required report exports |
| Medium | Dashboard chart/sales-by-hour detail incomplete | Confirm against owner-approved blueprint scope |
| Medium | Expiry/FIFO and adjustment coverage needs full traceability | Requirement-to-code tests and operational UAT |

## Deployment guidance

### Frontend

The Next.js frontend may be deployed independently for preview/UAT after a successful local production build. Netlify settings:

- Base directory: `apps/web`
- Build command: `npm run build`
- Node: 22
- Environment: `NEXT_PUBLIC_API_URL` set to the API origin

Do not point the live frontend at the in-memory demo API for real operations.

### API

Do not deploy this API as a live production service. The production startup guard is intentional. Keep it enabled until persistent repositories, schema, migrations, authentication provisioning and integration tests are complete.

## Owner decisions / external prerequisites

- Provision a PostgreSQL database for staging and production.
- Confirm the production website origin for CORS.
- Confirm owner administrator identity and bootstrap process.
- Approve M-Pesa/eTIMS integration scope and sandbox credentials when required.
- Confirm any blueprint owner decisions on wastage presentation, FIFO assumptions and expiry warning periods.

## Final status

**NO-GO for live restaurant operations.** The package is a hardened development/UAT candidate with a fail-closed production API guard, not a completed production system. Removing the guard without implementing and verifying persistence would reintroduce a critical data-loss risk.
