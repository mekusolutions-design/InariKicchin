# InariKicchin Phase 7 — implementation status

## Work completed in this continuation

- Re-inspected the supplied v5 archive and confirmed that `production-server.ts` still runs on `InariStore`, not PostgreSQL.
- Added a Prisma `AuthLoginAttempt` model for shared, database-backed login lockout state.
- Added `apps/api/src/modules/auth/persistent-auth.ts` implementing PostgreSQL-backed login, logout, and session resolution. Bearer tokens are random opaque values; only SHA-256 token digests are stored in `AuthSession`.
- Added an incremental SQL migration for `AuthLoginAttempt`.
- Added a safe `.env.example` using the variable names expected by the handover (`CORS_ORIGINS`, `INARI_TOKEN_SECRET`, `DATABASE_URL`, `DIRECT_URL`). It contains placeholders only.
- Ran the existing Prisma schema contract tests: 5 passed.

## Important migration limitation

The supplied v5 archive has **no prior Prisma migration history**. The added SQL file is an incremental migration and assumes the baseline tables (including `User` and `AuthSession`) already exist. It is **not** a complete initial schema migration and must not be applied to an empty database. A reviewed initial migration must be generated from the final schema using the pinned Prisma CLI, inspected, and reconciled with the actual target database before any deployment.

## Not completed / not verified

- Persistent authentication has been implemented as a service but is **not yet wired into the HTTP server**.
- The HTTP routes still use the in-memory `InariStore`.
- Purchasing, POS, payment, inventory, kitchen, closing, reports, menu, supplier and audit routes are not yet migrated to Prisma repositories.
- No PostgreSQL connection, migration application, data inspection, or integration test was performed.
- No Render deployment was performed.
- Full API tests and TypeScript compilation were not run. Dependency installation did not complete within the available execution window.

## Deployment status

**Not production-ready. Do not deploy this archive as a live API.** The production startup guard in `apps/api/src/production-server.ts` has intentionally been retained. It must not be removed until all routes are persistent, migrations are verified, integration tests pass, and staging deployment is checked.

## Required next engineering steps

1. Install the repository's locked dependencies and run Prisma validation/generation and the complete test suite.
2. Review the schema and produce a complete initial migration, after inspecting the target Supabase schema and confirming whether it contains data.
3. Apply migrations only to a confirmed staging database with rotated credentials.
4. Wire persistent authentication into the HTTP server and add auth integration tests.
5. Implement repositories and transactional application services for all existing route groups while preserving API contracts.
6. Add PostgreSQL integration tests for concurrency, idempotency, WAC, order/payment workflows, and rollback behaviour.
7. Deploy to Render staging and verify `/health`, `/ready`, authentication, and core workflows.
