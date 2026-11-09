# InariKicchin Phase 6 — Database-Backed Production API Execution Prompt

## Role
Act as a principal backend engineer, PostgreSQL/Prisma specialist, application security engineer, and regression-test lead. Work directly in the existing InariKicchin repository. This is an implementation assignment, not a request for another architecture-only report.

## Mission
Convert the existing API from its in-memory `InariStore` runtime to a PostgreSQL-backed production API using Prisma. Preserve the current HTTP contracts, restaurant workflows, permissions, data semantics, and calculations. Do not declare completion until the deployed production entry point uses durable repositories and the complete acceptance suite passes against a real PostgreSQL database.

## Non-negotiable safeguards
1. Treat the current in-memory domain implementation and its tests as the behavioural reference until parity is demonstrated.
2. Do not rewrite, simplify, round differently, or otherwise change weighted-average costing, stock valuation, unit conversion, VAT-inclusive/exclusive calculations, payment allocation, closing calculations, or accounting semantics.
3. Do not delete or bypass `production-server.ts`'s production safety gate to make Render start. Remove it only in the final release gate after all criteria below are evidenced.
4. Never use demo users, demo passwords, plaintext credentials, or hardcoded secrets in production. Do not seed sample stock, products, orders, suppliers, or sales into production.
5. Never use `prisma db push` as a production migration strategy. Use reviewed, committed, additive Prisma migrations with rollback/recovery notes.
6. Do not invent production database credentials. If `DATABASE_URL` / `DIRECT_URL` or a provisioned PostgreSQL environment is unavailable, implement and test what can be done locally, keep the production gate, and clearly mark database-backed acceptance as blocked.
7. Do not make unrelated frontend redesigns or API contract changes. Keep the existing UI and workflows working.
8. Every mutation must be tenant/shop-safe if shop scoping is present in the project; do not weaken authorization or ownership checks.

## Starting point and known state
- API package: `apps/api`; production entry: `apps/api/src/production-server.ts`.
- Current server still imports and mutates `seedDemoStore()` / `InariStore`; it is not yet database-backed.
- `apps/api/prisma/schema.prisma` contains the core restaurant schema and additional durable POS, payment, kitchen, session, idempotency, and stock movement models.
- Prisma packages are declared in the API workspace. Generate the client before relying on generated model types.
- A shared Prisma runtime helper exists at `apps/api/src/infrastructure/database.ts`; it requires `DATABASE_URL`, provides a read-only connectivity probe, and supports graceful disconnect. This helper is infrastructure only; it does not mean routes have been migrated.
- There is not yet a verified committed migration history or a successful PostgreSQL integration-test run in this baseline.
- The production startup gate must remain active until the complete implementation and evidence are ready.

## Required execution sequence

### Phase A — Repository and schema audit
1. Inspect every route in `production-server.ts`, every method in `domain/store.ts`, the complete Prisma schema, seed logic, frontend API client, and existing tests.
2. Produce a route-to-service-to-store-to-table mapping. Identify any domain concepts that have no durable model or are represented inconsistently.
3. Verify every Prisma relation, enum, optionality, delete policy, unique constraint, index, decimal precision, and timestamp policy.
4. Preserve existing public response shapes. Document any unavoidable data migration or API compatibility issue before coding.
5. Confirm whether historical data exists and prepare a non-destructive import/backfill strategy. Never assume an empty database.

### Phase B — Database foundation and migrations
1. Ensure Prisma CLI and `@prisma/client` versions are compatible and pinned consistently.
2. Run Prisma client generation and schema validation.
3. Create reviewed SQL migrations for the complete schema. Include indexes, constraints, foreign keys, and safe defaults.
4. Test migrations from an empty PostgreSQL database and from a representative prior schema/data snapshot.
5. Add migration deployment scripts suitable for Render release/pre-deploy execution. Application startup must not silently perform destructive schema changes.
6. Document required Render environment variables (`DATABASE_URL`, `DIRECT_URL`, bootstrap admin values, token secret) without committing actual values.

### Phase C — Repository layer
Implement typed Prisma-backed repositories behind service interfaces. Do not put Prisma queries directly into HTTP route handlers. At minimum cover:
- Users, roles, authentication sessions, revocation, login throttling, and audit events.
- Products, categories, units, suppliers, purchases, purchase lines, receiving, returns, adjustments, wastage, and stock closing.
- Makeline products and production.
- Menu categories, menu items, price history, VAT settings, order types, and payment methods.
- POS orders, immutable order-line snapshots, payments, kitchen tickets, ticket transitions, idempotency records, and stock movement ledger.

Repositories must support transactions supplied by application services. Avoid broad `any` types; use generated Prisma types and explicit DTO/domain mapping. Map Prisma Decimal values deliberately at the boundary without introducing floating-point drift into calculations.

### Phase D — Application service migration
Migrate each existing workflow in small slices. Keep domain calculations pure and shared where possible; persistence orchestration belongs in services.

For each slice:
1. Capture existing behaviour with characterization tests.
2. Implement the Prisma service/repository path.
3. Compare old and new outputs on identical fixtures.
4. Add database integration tests, including failure and concurrency cases.
5. Switch the route only after parity passes.
6. Keep a controlled rollback path until production verification.

Required workflow order:
1. Users/authentication/session/audit.
2. Reference data, menu, VAT and metadata.
3. Product and supplier reads.
4. Purchasing and receiving.
5. Adjustments, wastage, makeline and stock closing.
6. POS order creation, payment recording and kitchen ticket creation/transitions.
7. Voids/refunds and stock reversal rules.
8. Reports, dashboard, eTIMS receipt generation and exports.

### Phase E — Transaction and concurrency requirements
Use Prisma `$transaction` with appropriate isolation/locking strategy. Prove these atomicity rules:
- Receiving: purchase header, purchase lines, product on-hand updates, weighted-average-cost updates, stock movements, and audit entry commit together.
- POS: order header, immutable line snapshots, payment records, idempotency record, kitchen ticket, stock/recipe deductions (where the current business rules require them), and audit entries commit together.
- Payment changes: payment records and derived payment status cannot diverge.
- Kitchen transitions: ticket status, order status, transition history, and audit entry commit together.
- Void/refund: order state, payment/refund records, ticket state, permitted stock reversals, and audit entry commit together.
- Production: input deductions, output increments, production record, stock movements, and audit entry commit together.
- Closing: session, item snapshots, version/supersession links, and audit entry commit together.

Idempotency must be enforced by database unique constraints, not only application memory. Concurrent retries with the same key must return the same committed result and must never double-charge, double-receive, or double-deduct stock. Add tests for duplicate and racing requests.

Do not add inventory deductions to POS if the existing approved business rules do not currently require them. First inspect recipe semantics and existing behaviour; preserve it exactly and document any missing recipe configuration separately.

### Phase F — Authentication and provisioning
1. Persist sessions using a cryptographically random opaque token; store only a secure hash of the token in the database.
2. Validate expiry and revocation on every authenticated request; do not rely on a process-local Map.
3. Persist login failure/lockout state with concurrency-safe updates and avoid user enumeration.
4. Update last-login and audit events durably.
5. Bootstrap exactly one administrator from environment-provided email, name, and a strong password (minimum 16 characters). Hash with a modern password KDF and never log the secret.
6. Make bootstrap idempotent and safe to rerun; never reset an existing administrator's password during ordinary seed runs.
7. Keep demo users and demo endpoints unavailable in production.

### Phase G — HTTP wiring and operational readiness
1. Replace all production route dependencies on `InariStore` with application services backed by Prisma.
2. Preserve route paths, status codes, authorization matrix, payload shapes, CORS policy, and error semantics unless a documented security correction is necessary.
3. `/health` may report process health only. `/ready` must verify database connectivity and migration compatibility and return not-ready when unavailable.
4. Add graceful SIGTERM/SIGINT shutdown and Prisma disconnect.
5. Ensure startup fails closed when required environment variables, migrations, or database connectivity are missing.
6. Keep the production gate until all prior phases pass. Then replace the temporary gate with explicit readiness checks—not an unconditional bypass.

### Phase H — Test and release gates
Run and record:
- Existing pure domain tests (all must pass unchanged).
- Prisma generation and schema validation.
- Migration apply tests on a real PostgreSQL instance.
- Repository integration tests for every model group.
- End-to-end API tests for every route and role.
- Transaction rollback tests (inject failures between writes).
- Idempotency and concurrency tests.
- Authentication expiry, revocation, lockout, and bootstrap tests.
- Regression fixtures for WAC, stock valuation, units, VAT, closings, reports, and payment status.
- Frontend build and API contract smoke tests.
- Security checks for secrets, SQL injection, mass assignment, authorization bypass, and unsafe logging.

Do not claim a test passed unless it was executed. Separate unit, integration, build, migration, and live-deployment results.

## Acceptance criteria — all mandatory
- Production API routes no longer read from or write to `InariStore`.
- No process-local Map/array is the source of truth for users, sessions, inventory, purchases, orders, payments, kitchen, or audit data.
- Every listed business mutation uses a database transaction with rollback tests.
- Database uniqueness and idempotency prevent duplicate financial/inventory operations under concurrency.
- Existing workflow response contracts and calculations pass regression comparisons.
- PostgreSQL migrations apply cleanly and are committed.
- Secure administrator provisioning and persistent sessions are verified.
- `/ready` checks the database and schema readiness.
- Full integration suite passes against PostgreSQL.
- Only after all above: remove the temporary production startup block and deploy to a staging Render service first.
- Keep this prompt, migration notes, test report, deployment instructions, and project ZIP updated after every implementation batch.

## Required final deliverables
1. Updated source code and Prisma migrations.
2. Updated API and frontend tests.
3. `docs/DATABASE_BACKED_API_IMPLEMENTATION_REPORT.md` with completed/incomplete items and evidence.
4. `docs/DATABASE_MIGRATION_AND_ROLLBACK.md`.
5. Updated `.env.example` with variable names and safe placeholders only.
6. Updated Render deployment instructions.
7. A fresh ZIP of the complete repository, with no `node_modules`, secrets, `.env` files, or local database dumps.
8. A concise release decision: production-ready, staging-only, or blocked, with precise reasons.

## Working style
Work in small, reviewable increments. Before each high-risk migration, explain the exact files and behaviour affected. After each slice, run the relevant tests and update the implementation report. Never fabricate missing database access or test evidence. If external PostgreSQL credentials are unavailable, continue with schema/repository/unit-test work, but leave the production gate enabled and explicitly list the remaining integration steps.
