# InariKicchin — Engineering Completion Report
**Date:** 9 November 2026  
**Status:** Durable routes implemented and integration-tested against local PostgreSQL — **CONDITIONAL GO for staging**; **NO-GO for production** until staging smoke on Supabase/Render is confirmed.

## Executive summary

All production HTTP business routes in `production-server.ts` now prefer PostgreSQL-backed repositories when `DATABASE_URL` is set. Persistent auth, stock receipt, wastage, makeline production, stock closing, POS orders, kitchen transitions, order void, dashboard, products, menu, suppliers, closings, audit, and sales reports are implemented against Prisma.

Verified on local PostgreSQL 16:
- Migrations apply cleanly from empty DB
- Bootstrap seed provisions admin + reference data
- 53 domain/schema unit tests pass
- 4 PostgreSQL integration tests pass (auth, stock receipt/WAC, POS+kitchen+void+idempotency, reads)

Production safety gate remains: requires `DATABASE_URL` + `INARI_DURABLE_CONFIRMED=1`.

## Architecture

```
HTTP production-server.ts
  ├─ auth → persistent-auth.ts (opaque bearer + SHA-256 session digests)
  ├─ StockRepository  (purchases, wastage, makeline, closing)
  ├─ OrderRepository  (POS, payments, kitchen, void)
  ├─ ReadRepository   (dashboard, catalogues, reports, meta, audit)
  ├─ domain/*         (pure WAC, VAT, units — unchanged)
  └─ Prisma → PostgreSQL
```

When `DATABASE_URL` is absent, in-memory `InariStore` remains for local demo only (not production).

## Route-by-route persistence matrix

| Method | Path | Persistence when DATABASE_URL set | Auth |
|--------|------|-----------------------------------|------|
| GET | /health | n/a | public |
| GET | /ready | PostgreSQL SELECT 1 | public |
| POST | /auth/login | AuthSession + AuthLoginAttempt | public |
| POST | /auth/logout | AuthSession revoke | public |
| GET | /auth/demo-users | disabled when DB set | public |
| GET | /me | session | auth |
| GET | /dashboard | ReadRepository | dashboard:read |
| GET | /products | ReadRepository | products:read |
| GET | /orders | ReadRepository | orders:read |
| GET | /kitchen/tickets | ReadRepository | kitchen:read |
| GET | /audit | ReadRepository | audit:read |
| GET | /reports/sales | ReadRepository | reports:read |
| GET | /reports/sales.csv | still memory helper (export layout) | reports:read |
| GET | /reports/suppliers | still memory helper (phase4 analytics) | reports:read |
| GET | /menu | ReadRepository | menu:read |
| GET | /meta | ReadRepository | auth |
| GET | /closings | ReadRepository | closing:read |
| GET | /makeline | ReadRepository | auth |
| GET | /suppliers | ReadRepository | auth |
| POST | /purchases | StockRepository.receiveStock | purchases:write |
| POST | /closings | StockRepository.submitClosing | closing:write |
| POST | /pos/orders | OrderRepository.createOrder | pos:write |
| POST | /kitchen/tickets/:id/status | OrderRepository.updateTicketStatus | kitchen:write |
| POST | /orders/:id/void | OrderRepository.voidOrder | orders:void |
| GET | /orders/:id/etims | preparation only (memory layout) | orders:read |

## Tests executed

```
npm run test -w @inari/api
→ 46 domain + 7 schema = 53 pass

DATABASE_URL=... node --import tsx --test src/infrastructure/repositories/integration.node-test.ts
→ 4 pass (login/logout, stock WAC, POS/kitchen/void/idempotency, reads)
```

Migrations applied:
- 20261109000100_initial_database
- 20261109000200_enforce_stock_target_integrity

## Known residual gaps

1. Supplier analytics CSV and eTIMS receipt layout still use in-memory helpers for presentation only.
2. Product/supplier/menu **write** CRUD beyond purchases/closings/POS is not exposed as separate admin REST endpoints in the current HTTP surface (frontend may use limited mutations).
3. Offline queue durable path not fully reimplemented beyond IdempotencyRecord.
4. Concurrent multi-process load tests not run (Serializable transactions are used for critical writes).
5. Staging (Supabase + Render) smoke not executed in this environment.

## Staging steps

1. Apply migrations to Supabase staging (`prisma migrate deploy`).
2. Seed bootstrap admin.
3. Deploy API with DATABASE_URL, DIRECT_URL, INARI_TOKEN_SECRET, CORS_ORIGINS (do not set INARI_DURABLE_CONFIRMED yet).
4. Verify /ready → 200, login, purchase, POS, closing.
5. Set INARI_DURABLE_CONFIRMED=1 and restart.

## Release recommendation

**CONDITIONAL GO for staging deployment and verification.**  
**NO-GO for production** until staging smoke on real Supabase/Render succeeds and residual report helpers are either migrated or explicitly accepted.
