# Inari Kicchin API persistence gap analysis

**Prepared:** 9 November 2026  
**Scope:** Current API source, current Prisma schema, and Restaurant Management System Blueprint v1.0  
**Decision:** Keep production startup blocked until the gaps below are implemented and verified.

## 1. Current runtime architecture

`apps/api/src/production-server.ts` imports `seedDemoStore()` and routes reads and writes to an `InariStore` instance held in process memory. The Prisma schema is not imported by this server, and there is no repository implementation connecting the HTTP routes to PostgreSQL. Restarting the process therefore loses API mutations.

The production startup guard is correct and must remain until the replacement path is complete. `/health` is a process-liveness endpoint. `/ready` intentionally returns HTTP 503 with `durable: false` while the API uses the in-memory store.

## 2. Existing Prisma coverage

The baseline schema already defined (and this implementation batch has extended it with additional POS, payment, kitchen, session, idempotency and stock-movement models):

- Users and audit logs.
- System settings.
- Units, product categories, products and suppliers.
- Purchases and purchase items.
- Supplier returns.
- Stock adjustments and wastage records.
- Makeline products and production records.
- Stock closing sessions and closing items.
- Menu categories, menu items and menu price history.
- VAT settings, order types, payment methods and a minimal recipe-line structure.

These models are a useful foundation, but their existence is not evidence that the API persists to them.

## 3. Domain data with no complete durable model

The current in-memory domain defines `Order`, `OrderLine`, `Payment`, and `KitchenTicket`. The previous schema had no corresponding Prisma models for these records. Foundational models have now been added, but they are not yet connected to HTTP routes or validated against PostgreSQL. These are critical because POS transactions, split payments, order status changes, and kitchen workflow must survive restarts and be committed consistently.

Other missing or incomplete persistence concerns:

| Concern | Current gap | Required closure |
|---|---|---|
| Orders | No durable order header | Add order header with unique order number, type, status, payment status, VAT snapshot, totals, cashier, timestamps, void reason and idempotency key |
| Order lines | No durable line snapshots | Add order lines with menu item reference plus immutable name, price, quantity, VAT and totals snapshots |
| Payments | No durable payment rows | Add one-to-many payments with method, amount, reference, status, timestamps and reconciliation metadata |
| Kitchen | No durable kitchen tickets or transitions | Add ticket records and status timestamps/history; enforce one appropriate ticket per order or explicit split-ticket rules |
| Sessions | Auth sessions are held in a process-local `Map` | Add durable revocable sessions with expiry, token hash, user relation and indexes; never store raw bearer tokens |
| Login throttling | Failed attempts and lockouts are process-local | Use a shared durable/rate-limiting mechanism with expiry and safe keying |
| Idempotency | Closing session has a unique key, but order mutations do not have durable idempotency records | Add scoped idempotency records with request fingerprint, response reference and unique constraint; enforce in the same transaction as the mutation |
| Stock ledger | Current schema stores balances and source documents but no complete unified immutable stock movement ledger | Define movement types and source references so every receipt, adjustment, wastage, production and sale deduction is traceable exactly once |
| Recipes | `RecipeLine` has no declared relations, indexes or integrity constraints | Add foreign keys, output/input exclusivity constraints and unit compatibility validation in service logic |
| Settings | Some actor fields are unlinked strings; effective-dated settings need safe selection rules | Add relations where appropriate, audit changes, and enforce effective-date semantics |

## 4. Existing HTTP route migration map

Every route currently using `store` must move to a repository-backed application service before the production guard can be removed:

- Authentication: `/auth/login`, `/auth/logout`, `/me`.
- Dashboard and reads: `/dashboard`, `/products`, `/orders`, `/kitchen/tickets`, `/audit`, `/reports/sales`, `/reports/sales.csv`, `/reports/suppliers`, `/menu`, `/meta`, `/closings`, `/makeline`, `/suppliers`.
- Mutations: `/purchases`, `/closings`, `/pos/orders`, `/kitchen/tickets/:id/status`, `/orders/:id/void`.
- Receipt preparation: `/orders/:id/etims`.

The route contract and response shapes should be captured in tests before replacing the in-memory implementation.

## 5. Transaction boundaries that must be preserved

The following workflows must be atomic at the database level:

1. **Receive stock:** create purchase header and lines, update stock balance/valuation, record ledger entries, and audit the operation.
2. **Create POS order:** validate the menu snapshot, create order and lines, calculate VAT using the existing domain functions, create kitchen ticket(s), record idempotency and audit data.
3. **Take payment:** create payment record(s), recalculate payment status from persisted payments, and prevent overpayment/duplicate confirmation according to approved rules.
4. **Void order:** require reason and permission, preserve the original transaction, record reversal/refund semantics, and audit the action. Do not delete historical order lines or payments.
5. **Kitchen status transition:** validate allowed transition, update ticket, record transition timestamps/history and audit.
6. **Submit stock closing:** validate the immutable snapshot, persist header/items, apply closing semantics, and enforce the idempotency key in one transaction.
7. **Production/recipe deduction:** create production or sale records and all ingredient stock movements atomically; use existing cost and unit-conversion functions without changing their formulas.

## 6. Implementation sequence

1. Freeze the current HTTP response contracts and add route-level characterization tests.
2. Review and extend `schema.prisma` for order, order-line, payment, kitchen, sessions, idempotency, stock ledger and recipe relations.
3. Add Prisma and generated-client dependencies, pin versions, generate a lockfile, and validate the schema in CI.
4. Create additive, reviewed migrations. Do not rewrite historical domain data or silently recalculate stock valuation.
5. Implement repository interfaces and PostgreSQL implementations for each aggregate.
6. Move business workflows into application services that use Prisma transactions while calling the existing pure calculation functions.
7. Add database integration tests for constraints, transaction rollback, concurrent requests, duplicate idempotency keys and persistence across process restart.
8. Implement secure one-time owner provisioning and durable sessions/lockout. Never seed known passwords or demo stock into production.
9. Switch each HTTP route to the persistent service behind tests. Keep the production guard until all critical routes are migrated.
10. Run backup/restore drills, staging UAT and a controlled cutover. Only then may `/ready` report ready and the production guard be removed.

## 7. Business rules that must not change during persistence work

- Keep stock costing formulas, weighted-average valuation, stock closing calculations, VAT calculations and unit conversion semantics unchanged unless an explicit owner-approved blueprint change is made.
- Preserve decimal precision in PostgreSQL (`Decimal` fields); do not convert financial values through binary floating-point as the persistence source of truth.
- Preserve immutable purchase/order/closing snapshots and audit history.
- Keep the existing 42 domain regression tests passing; expand them with database-backed tests rather than replacing them.

## 8. External prerequisites and current limits

The implementation environment does not have the user's Render PostgreSQL connection string, production credentials, or Netlify/Render account access. Prisma Client and CLI dependencies plus database scripts are now declared in the API workspace. The production server is still not wired to Prisma. No migration, generated client, schema validation against a live PostgreSQL instance, or database integration is claimed by this report. Do not add credentials to this repository or to generated ZIP files.
