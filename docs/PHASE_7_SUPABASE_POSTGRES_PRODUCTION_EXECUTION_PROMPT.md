# InariKicchin — Phase 7 Supabase/PostgreSQL Production Implementation Prompt

## Mission

Continue from the existing **InariKicchin Database-Backed API Implementation v4** baseline. Do not restart the project, replace the architecture wholesale, or stop at a review. Implement the remaining work directly in the repository and deliver an updated, tested ZIP plus an evidence-based implementation report.

The objective is to replace the production API's process-local `InariStore` with durable PostgreSQL persistence through Prisma, while preserving the existing restaurant workflows, HTTP contracts, authorization rules, financial calculations, stock semantics, and frontend behaviour.

## Known baseline — verify before changing anything

- Monorepo: npm workspaces; API at `apps/api`; Next.js frontend at `apps/web`.
- Production API entrypoint: `apps/api/src/production-server.ts`.
- Current API routes still read and mutate `seedDemoStore()` / `InariStore`.
- `apps/api/src/infrastructure/database.ts` provides a shared Prisma client, `DATABASE_URL` validation, `SELECT 1` connectivity verification, and graceful disconnect. It is not yet wired into the HTTP routes.
- `apps/api/prisma/schema.prisma` contains core restaurant entities and foundational POS/order/payment/kitchen/session/idempotency/stock-movement models.
- There is currently no committed `apps/api/prisma/migrations` history in this baseline.
- `AuthSession` exists in the schema, but `apps/api/src/domain/auth.ts` still stores sessions and failed-login counters in process-local `Map` objects.
- The production startup guard intentionally throws while the server is memory-backed. Preserve it until the final release gate.
- The baseline report recorded 51 passing tests in its original environment. In this execution environment, dependencies were absent and `npm test -w @inari/api` could not start because `tsx` was not installed. Reinstall dependencies before making test claims.

## Security and environment handling

1. Treat any database password or token secret previously pasted into chat, terminal output, issue trackers, or source files as compromised. Rotate it before connecting to Supabase or deploying.
2. Never place actual credentials in this prompt, source files, migrations, reports, test fixtures, ZIPs, logs, commits, or screenshots.
3. Store production values only in the Render environment-variable dashboard or another approved secret manager. Use local `.env` files only when ignored by Git; provide `.env.example` with placeholders only.
4. Existing code reads `CORS_ORIGINS` (plural) and `INARI_TOKEN_SECRET`. It does **not** currently read `CORS_ORIGIN` or `JWT_SECRET`. Either configure the canonical variable names or deliberately implement and test backward-compatible aliases. Do not silently assume the supplied alternate names work.
5. `DATABASE_URL` should use the Supabase transaction pooler endpoint for runtime traffic (typically port `6543`, with `pgbouncer=true` as required by the connection mode). `DIRECT_URL` should use the Supabase session/direct connection endpoint suitable for Prisma migration operations (typically port `5432`). Verify the actual Supabase connection mode and Prisma compatibility; do not infer it solely from the port.
6. Production CORS should allow only the deployed Netlify origin. Keep `http://localhost:8082` in local-development configuration, not necessarily the production allowlist. Do not use wildcard CORS.
7. Keep `NODE_ENV=production`. Never bypass safeguards by changing it to development.
8. Before any destructive SQL or migration reset, verify the Supabase project is the dedicated InariKicchin database and confirm it is empty or that a reviewed backup exists. Do not drop Supabase-managed schemas, Auth, Storage, extensions, or platform objects.

## Non-negotiable business invariants

- Do not alter weighted-average-cost formulas, stock valuation order, receipt costing, closing calculations, wastage valuation, recipe deductions, VAT calculations, VAT-inclusive/exclusive handling, unit conversion factors, payment allocation, rounding, or decimal precision.
- Reuse the existing pure functions in `apps/api/src/domain/stock/calculations.ts`, `apps/api/src/domain/stock/units.ts`, `apps/api/src/domain/vat/calculations.ts`, and `apps/api/src/domain/phase4.ts`. Persistence code must call these functions rather than reimplementing the formulas.
- Persist money and quantities using Prisma `Decimal` / PostgreSQL `DECIMAL`; never use JavaScript floating-point as the financial source of truth.
- Preserve current routes, request and response shapes, permissions, statuses, report meanings, audit semantics, and frontend expectations. Add mapping layers instead of breaking API contracts.
- Preserve immutable historical snapshots for purchase lines, order lines, VAT, price history, stock closings, and audit records.
- Use append-only stock movements and reversal entries. Do not erase completed financial or stock history to make a workflow easier.
- Never seed demo users, known passwords, sample transactions, sample stock, or fabricated operational data in production.
- Keep authorization and shop/ownership checks intact. Do not trust client-supplied actor IDs when the authenticated session provides the actor.
- Every retryable mutation must have durable idempotency protection.

## Required implementation stages

### Stage A — Complete schema and migration audit

1. Inspect the entire Prisma schema, every API route, all `InariStore` methods, seed logic, frontend API client, existing tests, deployment configuration, and the Restaurant Management System Blueprint v1.0.
2. Produce a route → application service → repository → Prisma model mapping for every read and mutation.
3. Verify all relations, relation names, foreign keys, delete policies, enum values, nullability, unique constraints, indexes, decimal precision, timestamp/time-zone policy, and JSON fields.
4. Check for missing durable concepts, including purchase/receiving details, supplier returns, stock adjustments, wastage, makeline production, closing sessions/items, recipes, order types, payment methods, VAT settings, audit records, sessions, login lockouts, idempotency, orders, split payments, kitchen transitions, and stock ledger entries.
5. Resolve schema ambiguities explicitly. Add database constraints for mutually exclusive product/makeline references where appropriate; validate unit compatibility and workflow rules in application services.
6. Review foreign-key deletion behaviour. Historical records must not disappear when master data is deactivated or changed.
7. Produce a migration plan with a clear clean-database baseline and a non-destructive upgrade path for any environment that already contains data.

### Stage B — Generate and apply PostgreSQL migrations

1. Install the exact workspace dependencies from the lockfile; do not silently upgrade major versions.
2. Run Prisma format, validate, and generate. Fix every validation error before creating migrations.
3. Create a reviewed initial migration under `apps/api/prisma/migrations/` using Prisma Migrate. Do not use `prisma db push` as the production migration mechanism.
4. Inspect generated SQL for enums, foreign keys, indexes, defaults, decimal types, unique keys, and delete policies. Add reviewed SQL constraints where Prisma cannot express required invariants.
5. Apply migrations first to a disposable local/test PostgreSQL database, then to the dedicated empty Supabase staging database using the migration connection URL.
6. Verify `_prisma_migrations`, actual tables, constraints, indexes, and a clean second `migrate deploy` run.
7. Add migration verification scripts and document safe recovery/restore procedures. Never run destructive reset commands as part of routine deployment.

### Stage C — Persistent authentication and sessions

1. Replace process-local session maps with `AuthSession` records. Generate cryptographically random opaque tokens; store only a strong hash of each token.
2. Persist session expiry, revocation, last-seen metadata, and user relationship. Enforce active-user status and current role/permissions on each request.
3. Persist failed-login counters/lockout state in PostgreSQL or a shared rate-limit store; make updates atomic and resistant to concurrent attempts.
4. Preserve existing login/logout/me response contracts. Revoke sessions on logout and invalidate sessions when users are disabled or credentials are reset.
5. Implement secure one-time administrator provisioning using environment-provided bootstrap credentials or a one-time command. Never seed demo users or known passwords. Hash passwords using a reviewed password-hashing configuration and test verification/upgrade behaviour.
6. Ensure tokens, passwords, hashes, and secrets are never logged.

### Stage D — Purchasing, receiving, and stock operations

1. Implement repositories and application services for suppliers, products, units, categories, purchases, purchase items, supplier returns, adjustments, wastage, makeline items, production, and stock closings.
2. Migrate every corresponding route away from `InariStore` while preserving response contracts.
3. For receiving: transactionally create purchase header/items, update stock quantities and weighted average cost through existing calculation functions, write immutable stock movements, and write audit entries.
4. For returns, adjustments, wastage, production, and closing: apply the existing domain rules exactly, record source-linked movements once, and enforce permissions and idempotency.
5. Use appropriate transaction isolation/row locking or atomic conditional updates to prevent lost stock updates and negative-stock races. Prove behaviour under concurrent requests.

### Stage E — POS, payments, and kitchen workflows

1. Persist orders and immutable order-line snapshots, VAT/totals snapshots, order type, cashier, statuses, payments, and kitchen tickets/transitions.
2. A POS order transaction must create the order, order lines, initial payment records, kitchen ticket(s), inventory/recipe deductions, stock movements, idempotency record, and audit event atomically where the current workflow requires them to succeed or fail together.
3. Support multiple/split payments without losing payment method, amount, reference, status, or reconciliation detail.
4. Enforce payment totals and order payment status using exact Decimal arithmetic and the existing calculation semantics.
5. Make payment callbacks and order submissions idempotent. A repeated request with the same key and same payload returns the original result; reuse with a different payload must fail safely.
6. Persist kitchen status transitions with actor and timestamps. Enforce legal state transitions and keep ticket/order status consistent.
7. Implement void/refund as auditable compensating transactions. Never delete the original order, payment, or stock movement. Restore stock only through a correctly linked reversal when required by the existing rules.
8. Add transaction rollback tests proving that a failure at any intermediate step leaves no partial order, payment, kitchen ticket, or stock deduction.

### Stage F — Reporting, dashboard, and audit

1. Rebuild dashboard, product, order, kitchen, audit, sales, supplier, menu, metadata, closing, makeline, and supplier read routes using repositories.
2. Preserve report date boundaries, time zone, totals, filters, CSV output, and dashboard aggregation semantics.
3. Read reports from durable records and the stock ledger; do not rely on process memory or demo state.
4. Write audit events in the same transaction as the mutation they describe. Include actor, action, entity, before/after snapshots, reason, and request metadata without storing secrets.
5. Add indexes based on actual query patterns and verify query plans for high-volume endpoints.

### Stage G — PostgreSQL integration, concurrency, and rollback tests

1. Use a dedicated disposable PostgreSQL test database. Never point destructive test setup at production.
2. Add integration tests for every migrated repository and route, including auth/session persistence across process restart.
3. Add persistence-across-restart tests for purchases, stock, orders, payments, kitchen, closings, and audit history.
4. Add concurrent receiving, stock adjustment, POS submission, payment retry, and idempotency tests.
5. Add rollback tests for injected failures at each transaction boundary.
6. Run all existing domain tests and compare old in-memory behaviour with PostgreSQL-backed behaviour using equivalent fixtures.
7. Run schema validation, client generation, migration deploy, API tests, web build, and security/dependency review. Report exact commands and results. Do not report tests as passing if they were skipped or could not start.
8. Add backup/restore verification for the staging database before go-live.

### Stage H — Production startup and Render staging gate

Only after Stages A–G are complete:

1. Replace the memory-backed route wiring with Prisma-backed services. The production entry point must not import `seedDemoStore()` or use `InariStore` for business data.
2. Make `/ready` verify database connectivity and migration readiness, and report `durable: true` only when all required persistence services are active.
3. Keep `/health` as a liveness check; do not confuse it with readiness.
4. Add graceful shutdown for HTTP server and Prisma client.
5. Remove the startup guard only after all acceptance evidence exists. Never remove it merely to make Render start.
6. Deploy to Render staging with `NODE_ENV=production`, rotated secrets, verified Supabase URLs, and exact Netlify CORS origin.
7. Verify `/health`, `/ready`, login, authorized reads/writes, restart persistence, concurrency, and rollback on staging. Do not point live operations at the API until owner UAT and release sign-off are complete.

## Environment variable contract

Use these canonical names unless compatibility aliases are deliberately added and tested:

- `NODE_ENV=production`
- `CORS_ORIGINS=https://inarikicchin.netlify.app` for Render production. For local development, use `http://localhost:8082` in the local environment.
- `DATABASE_URL=<Supabase transaction-pooler URL for runtime>`
- `DIRECT_URL=<Supabase session/direct URL for Prisma migrations>`
- `INARI_TOKEN_SECRET=<new cryptographically random secret, at least 32 characters>`
- Secure bootstrap variables only if the one-time provisioning design requires them; never commit their values.

The current application reads `INARI_TOKEN_SECRET`, not `JWT_SECRET`, and reads `CORS_ORIGINS`, not `CORS_ORIGIN`. The user-provided alternate names must not be assumed to work. Update Render variable names or add tested aliases. Never place actual values in this document.

## Required deliverables

1. Updated source repository with all implemented changes.
2. Reviewed Prisma schema and committed migration SQL.
3. Route-to-service-to-repository-to-table audit matrix.
4. Updated `.env.example` containing placeholders only.
5. Automated unit, integration, concurrency, rollback, and migration tests.
6. Updated deployment and backup/restore documentation.
7. `PHASE_7_IMPLEMENTATION_REPORT.md` with completed/blocked items, exact commands, test counts, migration IDs, and evidence. Distinguish local test results from Supabase/Render results.
8. Updated `InariKicchin-Database-Backed-API-Implementation-vN.zip` containing the exact tested source state. Exclude `.env`, credentials, node_modules, build caches, and local database dumps.

## Definition of done

The task is not complete until every production API route uses durable persistence, authentication and sessions survive process restarts, all critical multi-record workflows are transactional and idempotent, all existing business calculations remain unchanged, PostgreSQL integration/concurrency/rollback tests pass, migrations are committed and applied, `/ready` proves durable readiness, and the production startup gate is removed only with evidence. If credentials or an accessible staging database are unavailable, complete all safe local implementation work, keep the gate active, and mark live database/deployment steps as blocked rather than claiming success.
