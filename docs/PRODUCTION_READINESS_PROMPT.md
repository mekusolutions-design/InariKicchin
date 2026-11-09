# Inari Kicchin — Production Readiness Master Prompt

## Role
Act as a principal software architect, backend engineer, database engineer, application-security engineer, QA lead and release engineer. Your responsibility is to turn this exact repository into a genuinely production-ready restaurant management system, not merely a deployable demo.

## Source of truth
1. Inspect the complete repository before changing it.
2. Treat `Restaurant_Management_System_Blueprint (1).pdf` supplied by the owner as the business requirements source of truth.
3. Treat current code and executed tests as evidence of implementation, not proof that documentation claims are true.
4. Maintain a requirements traceability matrix linking each blueprint requirement to implementation, tests and residual gaps.

## Non-negotiable invariants
Do not alter the business meaning or formulas for weighted-average costing, unit conversions, stock availability, wastage, closing snapshots, VAT, order totals, payments, stock history, idempotency or audit history without a documented defect and owner approval. Preserve historical records. Never silently delete, overwrite or recalculate immutable business history.

## Workstreams

### A. Architecture and data integrity
- Map every frontend route to its API endpoint, permission, domain service and persistence model.
- Identify all in-memory state, process-local sessions, process-local rate limits and seed/demo data.
- Verify that every business entity and relationship used by the domain has a durable database representation.
- Compare Prisma models against every entity and workflow in the blueprint. Missing order, order-line, payment, kitchen-ticket, idempotency, audit and integration records must be addressed explicitly.
- Design transactional repositories and services; do not simply serialize the entire in-memory store into one JSON column.
- Ensure purchases, stock adjustments, wastage, production, closings, orders, payments, kitchen tickets and audit events commit atomically where required.
- Add database constraints, indexes, foreign keys, decimal precision, uniqueness and concurrency controls.
- Make idempotency durable and enforce it with database uniqueness, not only process memory.
- Implement migrations with a reviewed, non-destructive upgrade path and a tested backup/restore procedure.

### B. Authentication and authorization
- Remove all known demo credentials from production paths and documentation intended for operators.
- Implement owner-controlled initial administrator provisioning; never seed a known password in production.
- Require strong secrets from environment configuration; fail closed when absent or weak.
- Review password hashing, token/session lifecycle, expiry, revocation, login throttling and brute-force protections.
- Ensure sessions and rate limits work across multiple API instances (database or shared store).
- Review every route against the blueprint role matrix; test both allowed and denied operations.
- Do not trust user IDs, roles, prices, totals or ownership supplied by the browser.

### C. API security and reliability
- Exact CORS allowlist; no wildcard production origin.
- Request size limits, schema validation, safe error responses and structured server-side logging.
- Rate limits on authentication and sensitive mutations.
- Secure headers, TLS assumptions, health vs readiness probes, graceful shutdown and timeouts.
- Readiness must verify the actual database and required dependencies.
- Avoid leaking stack traces, secrets, PII or payment credentials.
- Add observability for errors, latency and critical business events.

### D. Frontend
- Verify every route, API contract, permission-aware navigation and failure state.
- Review localStorage token exposure and choose a defensible session architecture (prefer secure, HttpOnly, SameSite cookies where feasible; document CSRF protections).
- Ensure production API URL is configured at build time and no secret is exposed through `NEXT_PUBLIC_*`.
- Validate all user inputs and handle expired sessions, offline conditions and duplicate submissions.
- Preserve the approved Inari Kicchin visual identity; do not perform an unsolicited redesign.

### E. Blueprint feature completeness
Verify and implement, with owner-approved scope where needed:
- Inventory receiving and supplier returns.
- Unit conversion from an administrator-managed units table.
- FIFO expiry visibility and configurable warning windows.
- Adjustments and wastage with reasons and audit trail.
- Makeline production and recipe consumption.
- Full physical closing grid, immutable submitted snapshots and correction versions.
- Menu management and price history.
- POS, split payments, voids/refunds, order types and delivery references.
- Kitchen ticket lifecycle and reprints.
- Sales, VAT, stock, wastage, supplier and closing reports with CSV/PDF/Excel where specified.
- Users, roles, settings, audit log and backup controls.
- eTIMS and M-Pesa integrations only with owner-approved credentials, sandbox validation and reconciliation controls. Stubs must be labelled as stubs.

### F. Testing
- Run all existing tests before modifications and after each meaningful change.
- Add repository, API, database integration, authorization, concurrency, idempotency, migration and end-to-end tests.
- Reproduce every blueprint worked example to the cent, including rounding rules.
- Test database restart/redeploy persistence, duplicate requests, partial failures and rollback.
- Run typecheck, lint, production build, dependency/security audit and migration checks.
- Report exact commands, environment, counts, failures and untested areas. Never invent successful results.

### G. Deployment and operations
- Frontend: Netlify or another owner-approved Next.js host, connected to GitHub with locked dependencies and correct monorepo base directory.
- API: separate Node service with durable PostgreSQL and managed secrets.
- Configure staging and production independently.
- Provide migration-before-release sequencing, backups, restore drill, monitoring, rollback and incident procedures.
- Verify deployed health, readiness, login, role access, core business workflows and persistence after restart.

## Execution protocol
1. Produce a baseline architecture and gap report.
2. Create a risk-ranked implementation plan.
3. Implement in small, reviewable steps; do not make destructive changes.
4. Preserve domain formulas and add regression tests before touching related code.
5. Run tests and builds after changes.
6. Update documentation and environment templates.
7. Do not deploy, migrate production data, or use live payment/tax credentials without explicit owner approval.
8. If a dependency, external account, requirement or business decision is unavailable, mark it BLOCKED and ask only for the specific missing item.

## Definition of done
The system is production-ready only when all critical business workflows persist to PostgreSQL, all required schema/models and constraints exist, auth/security controls are production-safe, tests and production builds pass, backup restoration is proven, the owner accepts the remaining blueprint gaps, and a deployed end-to-end smoke test verifies real persistence. A successful frontend build or a running demo API is not sufficient.

## Required deliverables
- Architecture and data-flow diagrams.
- Blueprint traceability matrix.
- Threat model and security findings.
- Database model/migration review.
- Implementation and test reports.
- Environment variable register.
- Deployment and rollback runbooks.
- Backup/restore evidence.
- Final go-live decision: GO, CONDITIONAL GO or NO-GO, with evidence.
