# InariKicchin engineering execution update — 9 November 2026

## Scope actually completed in this workspace

This update is based on the supplied repository archive. It does not claim a live Supabase, Render, or Netlify deployment.

### Repository findings

- The API production entry point (`apps/api/src/production-server.ts`) still imports `seedDemoStore()` and performs all business reads and writes against an `InariStore` in process memory.
- Persistent authentication exists as a service (`apps/api/src/modules/auth/persistent-auth.ts`) but is not connected to the HTTP server.
- No Prisma repository/application-service layer exists for purchases, inventory, wastage, makeline production, closings, menu, POS, payments, kitchen, reports, supplier analytics, or offline queue processing.
- The production startup guard is therefore correct and remains enabled.
- The Prisma schema contains durable models for orders, order lines, payments, kitchen tickets/transitions, sessions, idempotency records, stock movements, and login attempts. These models are not proof of runtime persistence.
- `/ready` correctly remains HTTP 503 while storage is in-memory.
- eTIMS payload creation and M-Pesa confirmation are local preparation/stub functionality, not verified external integrations.
- Existing frontend pages are present, but the API's currently exposed route set is much narrower than all the domain capabilities requested in the project specification.

### Changes made in this continuation

1. Added `verifyPersistentPassword()` to the domain auth module. It accepts only the established `scrypt:` hash format, while the legacy `hashed:` compatibility remains available to the demo-only authentication flow.
2. Changed persistent database authentication to use `verifyPersistentPassword()`. A legacy `hashed:plaintext` database record can no longer authenticate against the persistent API service.
3. Added an additive PostgreSQL migration at `apps/api/prisma/migrations/20261109000200_enforce_stock_target_integrity/migration.sql`. It enforces exactly-one target rules for recipe outputs/inputs, stock adjustments, wastage, stock closing items, and stock movements. It does not drop, truncate, or delete data. If pre-existing rows violate these checks, PostgreSQL will reject the migration rather than silently rewriting the rows.
4. Extended the Prisma schema contract tests to check that all six constraints remain present.

### Checks executed

- Domain/unit suite using Node 22's built-in TypeScript stripping: **46 tests passed, 0 failed**.
- Prisma schema/migration contract suite: **7 tests passed, 0 failed**.
- Total executed tests across those two commands: **53 passed, 0 failed**.

The tests above are local tests. They do not exercise PostgreSQL, database transaction rollback, concurrency under PostgreSQL, or deployed services.

### Checks not completed

- `npm ci` did not complete within the execution window; an offline retry confirmed that the required TypeScript tarball is not present in the local npm cache.
- Prisma Client generation and `prisma validate` were not run because dependencies could not be installed.
- TypeScript compiler checks, lint, API package build, and Next.js production build were not run.
- No PostgreSQL credentials were supplied. No database was identified, inspected, migrated, reset, or modified.
- No staging integration/concurrency tests were run.
- No Render or Netlify deployment was performed.

## Release decision

**NO-GO for production.** The production startup guard must remain. All production business routes still use the in-memory store; persistent auth is not wired into HTTP; there is no complete repository/service implementation; and live PostgreSQL integration has not been verified.

## Exact remaining engineering work

1. Complete Prisma repository and transactional application-service implementations for every production route and domain operation.
2. Wire persistent authentication and permission checks into the production HTTP server without changing existing API contracts.
3. Add PostgreSQL integration and concurrency tests, including rollback, duplicate idempotency keys, simultaneous receipts, closings, POS requests, and ticket transitions.
4. Verify the initial migration against the actual staging database and apply migrations only after confirming that the target is the intended, backed-up staging database and checking for rows that violate the new constraints.
5. Install locked dependencies in a network-enabled environment; run Prisma generation/validation, TypeScript, lint, API build, and frontend build.
6. Verify health/readiness, authentication, and representative workflows against staging before considering production deployment.
