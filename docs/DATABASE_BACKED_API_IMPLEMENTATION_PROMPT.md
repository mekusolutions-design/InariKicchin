# InariKicchin — Database-Backed Production API Implementation Prompt

## Mission

Act as a senior backend/platform engineer responsible for completing the InariKicchin restaurant management API. Your task is to turn the existing API into a genuinely PostgreSQL-backed production API while preserving the restaurant's existing workflows, API contracts, calculations, audit semantics and operational behaviour.

This is an implementation assignment, not a planning-only review. Inspect the repository, make the changes, run the available tests, add missing tests, update deployment documentation and keep the deliverable ZIP synchronized with every change. Work in small, verifiable stages. Do not stop after producing recommendations or a gap analysis.

## Repository and deployment context

- Project: InariKicchin (preserve this exact spelling).
- Monorepo: npm workspaces; `apps/api` is the Node/TypeScript API and `apps/web` is the Next.js frontend.
- Deployment target: API on Render with PostgreSQL; web frontend on Netlify.
- Existing API entrypoint: `apps/api/src/production-server.ts`.
- Existing deterministic in-memory domain implementation: `apps/api/src/domain/store.ts`.
- Existing pure business logic: `apps/api/src/domain/stock/calculations.ts`, `apps/api/src/domain/stock/units.ts`, `apps/api/src/domain/vat/calculations.ts`, and `apps/api/src/domain/phase4.ts`.
- Existing Prisma schema: `apps/api/prisma/schema.prisma`.
- Existing seed: `apps/api/prisma/seed.ts`.
- Read `docs/API_PERSISTENCE_GAP_ANALYSIS.md`, `docs/PRODUCTION_READINESS_REPORT.md`, `docs/DEPLOYMENT.md`, `PRODUCTION_RELEASE_NOTES.md`, and the Restaurant Management System Blueprint before changing behaviour.
- The current `production-server.ts` intentionally blocks `NODE_ENV=production` because it still uses an in-memory `InariStore`. Preserve that protection until all critical routes are genuinely persistent and tested.

## Non-negotiable business invariants

1. Do not change weighted-average-cost (WAC) formulas, stock valuation order, receipt costing, closing calculations, wastage valuation, recipe deductions, VAT calculations, VAT-inclusive/exclusive handling, unit conversion factors, rounding or decimal precision as part of persistence work.
2. Reuse the existing pure calculation functions. Persistence adapters must call the established domain functions rather than duplicate or reinterpret formulas.
3. Use PostgreSQL `DECIMAL`/Prisma `Decimal` for persisted money, quantities and unit costs. Do not use binary floating-point as the financial source of truth. Convert to API number/string formats only at the established boundary and preserve existing response contracts.
4. Preserve existing HTTP routes, request shapes, response shapes, permissions, status transitions, report semantics and frontend expectations. Add compatibility mapping where database naming differs from current camelCase API objects.
5. Preserve historical snapshots: purchase/order line names and prices, VAT snapshots, closing snapshots, audit history and void history must not silently change when master data changes.
6. Never delete or overwrite completed financial/stock history to make a migration easier. Use append-only movements, reversals and audit entries where appropriate.
7. Do not seed demo users, known credentials, sample transactions, stock balances or fabricated business data into production.
8. Never put secrets, database URLs, real passwords, tokens or private customer data in source control, logs, reports or ZIP artifacts.
9. Do not weaken authentication, authorization, validation, idempotency, database constraints or production startup checks to obtain a successful deploy.
10. Do not use `npm audit fix --force` or make major dependency upgrades without reviewing breaking changes and recording the reason.

## Required execution sequence

### Stage 0 — Baseline and characterization

- Inspect the entire repository and current API route handlers, domain store, auth implementation, Prisma schema and frontend API client.
- Record every API route, payload, response, permission and side effect.
- Add characterization/contract tests for current workflows before replacing the in-memory implementation.
- Run all current tests and capture the baseline. Do not claim unexecuted tests passed.
- Identify API response compatibility risks and any existing bugs separately from persistence work. Do not silently fix unrelated behaviour.

### Stage 1 — Database schema and migrations

- Complete and validate Prisma models for users, durable sessions, audit, products, units, suppliers, purchases, supplier returns, adjustments, wastage, makeline, stock closings, menu, VAT/settings, order types, payment methods, recipe relations, POS orders, immutable order lines, payments, kitchen tickets and transition history, idempotency records, and a unified stock movement ledger.
- Add foreign keys, unique constraints, indexes, appropriate delete restrictions, timestamps and decimal precision.
- Ensure every stock-changing operation can be traced to one source record and is applied exactly once.
- Define and document constraints for mutually exclusive recipe output/input references and valid stock movement targets. Where PostgreSQL CHECK constraints are needed, add them in reviewed SQL migrations.
- Generate additive, reviewable migrations. Never use `db push` against production. Never reset a live database.
- Validate schema and migration SQL against a clean disposable PostgreSQL database. Document migration order and rollback/forward-repair strategy.
- Generate and commit a reproducible root workspace lockfile.

### Stage 2 — Persistence architecture

- Introduce a Prisma client lifecycle module with connection pooling appropriate for Render, graceful shutdown and explicit connection health checks.
- Define repository interfaces and PostgreSQL implementations. Keep domain calculations independent from Prisma.
- Separate HTTP transport, application services, domain calculations and persistence.
- Keep the in-memory store as a deterministic test/demo adapter only. It must not be used by the production server.
- Add safe mapping between Prisma records and the existing API DTOs. Do not leak Prisma objects directly into HTTP responses.

### Stage 3 — Durable authentication and security

- Persist users and sessions. Store only a cryptographic hash of bearer tokens, never raw tokens.
- Enforce expiry, revocation, active-user checks, role permissions and safe logout across multiple API instances.
- Implement shared login throttling/lockout using a durable store or an explicitly chosen shared rate-limit service; process-local maps are insufficient for multi-instance production.
- Use secure password hashing and constant-time comparison. Ensure password hashes never appear in API responses or logs.
- Keep bootstrap admin provisioning one-time, environment-driven and repeatable without resetting an existing password. Document secret rotation and recovery.

### Stage 4 — Migrate business workflows in controlled slices

For each slice, implement repository methods, application service, route wiring, integration tests, transaction tests and response compatibility tests before moving to the next:

1. Reference data, users, products, units, suppliers and menu.
2. Receiving/purchases: purchase header + lines + stock balance/WAC update + stock movement ledger + audit in one transaction.
3. Stock adjustments, wastage, supplier returns and makeline production with atomic stock movements.
4. Stock closing: immutable header/items, version/supersession rules and idempotency in one transaction.
5. POS order creation: order header + immutable lines + VAT snapshots + payment records + kitchen ticket(s) + recipe/stock deductions where configured + idempotency + audit in one transaction.
6. Payments and reconciliation: persist each payment, calculate payment status from confirmed persisted records, guard duplicate provider confirmations and follow existing overpayment rules.
7. Kitchen transitions: validate existing allowed transitions, persist timestamps and transition history atomically.
8. Voids/refunds: retain original records, record reason and reversal entries, preserve permission and accounting semantics.
9. Dashboard, reports, CSV, supplier analytics, eTIMS/receipt preparation and all remaining reads against persisted data.

Every write workflow must be safe under retries and concurrent requests. Use transaction isolation/row locking or optimistic concurrency where needed. A unique idempotency key alone is not enough: persist and compare a request fingerprint and store the outcome in the same transaction as the business mutation.

### Stage 5 — Frontend compatibility

- Inspect the actual frontend API calls and types.
- Preserve route names and response shapes unless a coordinated, tested frontend change is unavoidable.
- Ensure login, dashboard, inventory, receiving, POS, payments, kitchen, closings, reports and admin screens continue to work against the persistent API.
- Do not redesign the UI or alter restaurant workflows as part of this backend assignment.

### Stage 6 — Verification

Required evidence before production enablement:

- All existing domain regression tests pass unchanged.
- New repository tests against PostgreSQL cover create/read/update, constraints, decimal round trips and foreign-key behaviour.
- Integration tests cover every critical route and permission boundary.
- Transaction rollback tests prove no partial purchase, POS, payment, closing or stock operation is committed.
- Concurrency tests cover duplicate idempotency keys, simultaneous stock receipts/sales and payment confirmation races.
- Persistence-across-restart test: write records, terminate API process, start a new process, and verify records and sessions behave correctly.
- WAC/VAT/unit-conversion/closing golden tests compare the persistent workflow with the existing in-memory baseline using identical fixtures and assert exact expected results within the established decimal precision.
- Migration tests run from an empty database and from a representative prior schema. Never fabricate a production dataset.
- Frontend production build and API build/typecheck pass.
- `npm audit` findings are reviewed and documented; no blind force-fix.
- Health/readiness semantics are correct: liveness may be healthy while readiness remains false until DB connectivity and required migrations are verified.

### Stage 7 — Production cutover

- Keep production startup blocked until every critical route above is persistent and all acceptance evidence is present.
- Add startup checks for database connectivity and migration compatibility.
- `/ready` must return ready only when durable persistence is connected and the schema is at the expected migration level.
- Remove the in-memory production guard only after code review and test evidence prove no production route uses the in-memory store.
- Document Render environment variables, PostgreSQL provisioning, migration command, one-time admin bootstrap, backup schedule, restore drill, monitoring and rollback/forward-repair plan.
- Do not attempt a live deployment or migration without explicit access/credentials and approval.

## Definition of done

The objective is complete only when:

- The production HTTP server uses PostgreSQL repositories for every critical business route and no live operation depends on process memory.
- Orders, lines, payments, kitchen tickets, users/sessions, purchases, stock balances/movements, closings, menu and audit data survive process restarts.
- All critical multi-record workflows are transactional and retry-safe.
- Existing calculations and workflows are preserved by regression evidence.
- Prisma migrations are committed and validated against PostgreSQL.
- All relevant automated tests and the frontend build pass.
- `/ready` reports durable readiness only when it is true.
- The production guard is removed only with evidence, never to silence a deployment error.
- Documentation and the final ZIP contain every code/config/test/migration/documentation change.

## Required final deliverables

1. Updated source tree with complete implementation.
2. Prisma schema and reviewed migration files.
3. Repository and application-service code.
4. API integration, database, concurrency and regression tests.
5. Updated frontend integration only if needed for compatibility.
6. Updated `.env.example` files with placeholders only.
7. Updated deployment/runbook and migration documentation.
8. An implementation report separating completed, partially completed, blocked and unverified items.
9. A fresh ZIP of the complete project, integrity-tested, with a changelog and no secrets, `node_modules`, build caches or local database dumps.

## Execution discipline

- Start by inspecting the repository and reconciling this prompt with the actual source; do not assume documentation is correct if code contradicts it.
- Implement as much as can be safely completed in this environment. Do not stop after writing this prompt.
- If an external prerequisite blocks a step (PostgreSQL service, credentials, network package installation, account access), continue with independent code/tests, record the exact blocker and do not claim the blocked step is complete.
- At each stage run tests and inspect the diff. Fix regressions before proceeding.
- Update the ZIP after every meaningful implementation batch and regenerate it at the end.
- Never describe a schema-only change as a database-backed API. Never describe a deployment configuration as a successful deployment.
- The final response must state exactly what was changed, what tests were run and their results, what remains incomplete, and link the verified ZIP and prompt.
