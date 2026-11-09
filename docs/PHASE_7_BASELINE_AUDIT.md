# InariKicchin Phase 7 — Baseline Audit

**Starting artifact:** `InariKicchin-Database-Backed-API-Implementation-v4.zip`  
**Decision:** BLOCKED — no production database migration or route persistence has yet been applied.

## Verified findings from the v4 source

| Area | Current state | Required work |
|---|---|---|
| HTTP runtime | `production-server.ts` imports `seedDemoStore()` and uses an in-memory `InariStore` for every business route | Replace with persistent application services and repositories |
| Production safety | Startup throws when `NODE_ENV=production`; `/ready` returns 503 with `durable: false` | Preserve until all release gates pass |
| Prisma runtime | Shared Prisma client helper exists with `DATABASE_URL` guard, `SELECT 1`, and disconnect | Wire into server lifecycle and readiness after repository implementation |
| Migrations | `apps/api/prisma/migrations` is absent; schema and seed files exist | Audit schema, create reviewed baseline migration, apply to staging |
| Authentication | Session and failed-login state are process-local Maps in `domain/auth.ts` | Persist hashed-token sessions and lockout state |
| Purchasing/stock | Prisma models exist for purchases, returns, adjustments, wastage, production, and closings | Build repositories and transaction-safe services; stock movement ledger must cover every mutation exactly once |
| POS/payments/kitchen | Schema includes orders, lines, payments, tickets, transitions, and idempotency records | Implement route wiring, split payments, recipe deductions, legal transitions, void/refund compensation, and atomicity |
| Reporting/audit | Current routes read in-memory arrays and store aggregation methods | Rebuild repository-backed queries and transactionally persist audit events |
| Tests | v4 report records 51 passing tests in its original environment | Current extracted workspace has no installed `tsx`; `npm test -w @inari/api` fails before tests run with `ERR_MODULE_NOT_FOUND: tsx` |

## Current route inventory

| HTTP route | Current backing | Persistence target / workstream |
|---|---|---|
| `GET /dashboard` | `store.dashboard()` | Repository aggregates across orders, payments, stock, and settings |
| `GET /products` | `store.products` | `Product`, category, unit, stock movement/balance |
| `GET /orders` | `store.orders` | `RestaurantOrder`, lines, payments |
| `GET /kitchen/tickets` | `store.tickets` | `KitchenTicket`, transitions, order lines |
| `GET /audit` | `store.audit` | `AuditLog` |
| `GET /reports/sales` | `store.salesReport()` | Durable orders/payments with date and status semantics |
| `GET /reports/sales.csv` | `salesReportCsv(store, ...)` | Same durable report query and CSV contract |
| `GET /reports/suppliers` | `supplierAnalytics(store, ...)` | Purchases, purchase items, supplier returns |
| `GET /menu` | In-memory categories/items | `MenuCategory`, `MenuItem`, price history, recipes |
| `GET /meta` | In-memory settings/users | `OrderType`, `PaymentMethod`, VAT settings, active users |
| `GET /closings` | `store.closings` | `StockClosingSession`, `StockClosingItem` |
| `GET /makeline` | `store.makelineProducts` | `MakelineProduct`, units, production records |
| `GET /suppliers` | `store.suppliers` | `Supplier` |
| `POST /purchases` | `store.receiveStock()` | Purchase + lines + stock balance/WAC + stock movements + audit in one transaction |
| `POST /closings` | `store.submitClosing()` | Closing session/items + stock/usage valuation + audit in one transaction |
| `POST /pos/orders` | `store.createOrder()` | Order + lines + payments + recipe deductions + kitchen + idempotency + audit in one transaction |
| `POST /kitchen/tickets/:id/status` | `store.updateTicketStatus()` | Ticket status + transition + order status + audit transaction |
| `POST /orders/:id/void` | `store.voidOrder()` | Void state + payment/refund semantics + stock reversal + audit transaction |
| `GET /orders/:id/etims` | In-memory order and `buildEtimsReceipt()` | Durable order and immutable VAT/totals snapshots |
| `POST /auth/login`, `/auth/logout`, `GET /me` | In-memory users/sessions/lockouts | `User`, `AuthSession`, durable login throttling; no raw token storage |

## Environment contract mismatch found

- Current API reads `CORS_ORIGINS`, not `CORS_ORIGIN`.
- Current API reads `INARI_TOKEN_SECRET`, not `JWT_SECRET`.
- Prisma schema reads `DATABASE_URL` and `DIRECT_URL`.
- Keep actual secrets outside the repository. Rotate any credential exposed in chat before connecting.

## Execution environment limitation

The v4 archive contains no `node_modules` and no lockfile. Running `npm test -w @inari/api` fails before tests execute because the `tsx` package is not installed. Therefore this audit does not claim the baseline tests pass in the current workspace. Install dependencies from the repository's intended lockfile or regenerate a reviewed lockfile before continuing.

## Release rule

No production migration has been generated or applied in this batch. No Supabase connection was attempted. Keep the production startup guard. The next safe execution step is credential rotation and installation of the pinned workspace dependencies, followed by Prisma schema validation against a disposable PostgreSQL instance.
