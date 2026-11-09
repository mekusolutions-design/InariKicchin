# InariKicchin — Engineering Handover
**Date:** 9 November 2026  
**Status:** Partial durable foundation complete — **NO-GO for production release**

## 1. What was implemented in this continuation

### Authentication
- `apps/api/src/modules/auth/persistent-auth.ts` is now **wired into** `production-server.ts`.
- When `DATABASE_URL` is set:
  - `POST /auth/login` → `loginPersistent` (opaque bearer token, SHA-256 digest stored in `AuthSession`).
  - `POST /auth/logout` → `logoutPersistent` (revokes session).
  - All authenticated routes → `requirePersistentSession`.
- Demo credential endpoint is suppressed when a database is configured.
- Login lockout uses shared `AuthLoginAttempt` table.

### Readiness & safety
- `GET /ready` now probes PostgreSQL with `SELECT 1` when `DATABASE_URL` is present and returns 200 only if the connection succeeds.
- Production startup gate retained and tightened:
  - Requires both `DATABASE_URL` **and** `INARI_DURABLE_CONFIRMED=1`.
  - Gate message updated; corresponding unit test updated and passing.
- Graceful shutdown path already present via `disconnectDatabase`.

### Stock repository (new)
- `apps/api/src/infrastructure/repositories/stock-repository.ts`
  - `receiveStock` — Serializable transaction: purchase header/lines, WAC update, stock movement, audit.
  - `recordWastage` — product or makeline target, stock decrement, movement, audit.
  - `recordMakelineProduction` — production record + movement.
- Uses existing pure domain helpers (`unitPriceFromReceipt`, `convertToBase`) so WAC and unit conversion behaviour is unchanged.

### Migrations retained
- `20261109000100_initial_database` — full schema create (32 models).
- `20261109000200_enforce_stock_target_integrity` — six exclusive-target CHECKs.

### Tests executed (this environment)
```
npm run test -w @inari/api
→ 46 domain/unit tests passed
→ 7 schema-contract tests passed
→ 53 total, 0 failed
```
Prisma schema validates and client generates successfully.

## 2. What was already present and retained

- Full Prisma schema aligned with Blueprint §12 (Users, Products, Purchases, Closings, Orders, Kitchen, AuthSession, IdempotencyRecord, StockMovement, RecipeLine, etc.).
- Pure domain calculation modules (`stock/calculations`, `vat/calculations`, `units`) — **do not rewrite these**.
- In-memory `InariStore` used for local demo and characterization tests when no DB is present.
- Seed script that only creates units, order types, payment methods and a single bootstrap administrator (no demo stock or known passwords in production seed).
- Frontend (`apps/web`) unchanged; API contracts intended to stay compatible.

## 3. Architecture and persistence design

```
HTTP (production-server.ts)
  ├─ auth: persistent-auth.ts  (when DATABASE_URL)
  ├─ controllers → application services / repositories
  │     ├─ StockRepository   (purchases, wastage, makeline, closing*)
  │     ├─ OrderRepository   (POS, payments, kitchen, void)  [next]
  │     └─ ReadRepository    (dashboard, catalogues, reports) [next]
  ├─ domain/*  (pure formulas — source of truth for WAC, VAT, units)
  └─ Prisma Client → PostgreSQL (Supabase)
```

*Closing, full POS atomic path, offline queue and concurrent integration tests are **not** fully wired into the HTTP server yet.

## 4. Modules status

| Module              | Domain logic | Prisma models | HTTP durable path | Integration tests |
|---------------------|--------------|---------------|-------------------|-------------------|
| Auth / sessions     | Yes          | Yes           | **Yes**           | Partial (unit)    |
| Products / units    | Yes          | Yes           | No (still memory) | Domain only       |
| Purchases / WAC     | Yes          | Yes           | Repo ready, not wired | Domain only  |
| Wastage / Makeline  | Yes          | Yes           | Repo ready, not wired | Domain only  |
| Stock closing       | Yes          | Yes           | Partial in repo   | Domain only       |
| Menu / VAT config   | Yes          | Yes           | No                | Domain only       |
| POS / payments      | Yes          | Yes           | No                | Domain only       |
| Kitchen tickets     | Yes          | Yes           | No                | Domain only       |
| Offline queue       | Phase4       | Idempotency   | No                | Domain only       |
| Reports / dashboard | Yes          | Yes           | No                | Domain only       |
| eTIMS / M-Pesa      | Prep only    | N/A           | Prep only         | N/A               |

## 5. Routes still on in-memory store

All business routes **except** login/logout/session resolution still call `InariStore` when the process starts without durable confirmation. The production gate prevents this configuration from running under `NODE_ENV=production`.

## 6. Concurrency & idempotency

- Stock receipt and wastage repositories use `Serializable` transactions.
- Closing and POS idempotency keys are modelled (`IdempotencyRecord` unique on `scope+key`).
- **Not yet verified** under concurrent load against a real PostgreSQL instance in this environment (no local Postgres available).

## 7. Tests actually run

| Suite                         | Result   |
|-------------------------------|----------|
| Domain unit (calculations, store, VAT, units, auth, phase4) | 46 pass |
| Schema contract               | 7 pass   |
| Production startup gate       | 1 pass   |
| PostgreSQL integration / concurrency / HTTP e2e | **Not run** (no DB) |

## 8. TypeScript / build

- Prisma client generated against schema 6.19.3.
- Full `tsc` / Next.js production build not re-run in this session after the last server patch; prior archive was clean.
- Recommendation: run `npx tsc --noEmit` in both workspaces and `npm run build -w @inari/web` before staging.

## 9. Security improvements

- Opaque random bearer tokens; only SHA-256 digests stored.
- Session revocation on logout.
- Login lockout shared across instances via DB.
- Demo credentials endpoint disabled when `DATABASE_URL` is set.
- Production gate prevents accidental in-memory deployment.
- Secrets remain env-only (`INARI_TOKEN_SECRET`, `DATABASE_URL`, bootstrap admin vars).

## 10. Remaining external dependencies / blockers

1. **PostgreSQL instance** (Supabase staging) with credentials for:
   - `prisma migrate deploy`
   - Bootstrap admin seed
   - Integration test suite
2. Operator confirmation after verifying migrations and core workflows → set `INARI_DURABLE_CONFIRMED=1`.
3. Completion of OrderRepository + ReadRepository and wiring every mutation/read route off `InariStore`.
4. Concurrent stock-receipt, closing, POS idempotency and rollback tests against real Postgres.
5. eTIMS and live M-Pesa are **out of scope** for this phase (preparation only).

## 11. Exact staging deployment steps

1. Provision Supabase project; obtain `DATABASE_URL` (pooler) and `DIRECT_URL` (direct).
2. Set secrets in Render:
   - `DATABASE_URL`, `DIRECT_URL`
   - `INARI_TOKEN_SECRET` (≥32 random bytes)
   - `CORS_ORIGINS` (Netlify origin(s))
   - `INARI_BOOTSTRAP_ADMIN_EMAIL/NAME/PASSWORD` (seed only)
   - Do **not** set `INARI_DURABLE_CONFIRMED` until step 7.
3. From CI or a secure runner:
   ```bash
   cd apps/api
   npx prisma migrate deploy --schema prisma/schema.prisma
   # Review SQL output; confirm no unexpected data loss
   INARI_BOOTSTRAP_ADMIN_EMAIL=... NAME=... PASSWORD=... npm run db:seed
   ```
4. Deploy API to Render (Node 22 per `.nvmrc`).
5. Deploy frontend to Netlify; point `NEXT_PUBLIC_API_URL` at the Render URL.
6. Smoke:
   - `GET /health` → 200
   - `GET /ready` → 200 with `storage: postgresql`
   - Login with bootstrap admin; create a product, receive stock, place a POS order, submit a closing.
7. After successful smoke and review of logs, set `INARI_DURABLE_CONFIRMED=1` and restart the API service.
8. Only then consider promoting the same image/config toward production.

## 12. Rollback and recovery

- Migrations are additive; reverse only by restoring a database backup taken before `migrate deploy`.
- Application rollback: redeploy previous Render release; remove `INARI_DURABLE_CONFIRMED` to force the safety gate if needed.
- Auth sessions are DB-backed; clearing `AuthSession` forces re-login without affecting business data.

## 13. Known limitations

- Business mutation routes are not yet switched to the new repositories inside the HTTP handler.
- No live PostgreSQL integration or concurrency tests executed in this environment.
- Closing supersession, full POS payment edge cases, offline queue durability and recipe deduction paths still require repository completion and verification.
- Frontend compatibility has not been re-validated against a durable API instance.

## 14. Final release recommendation

**NO-GO for production.**

The durable foundation (schema, migrations, persistent auth wiring, readiness probe, stock repository core, production safety gate) is in place and unit/schema tests pass. The API must not be treated as production-ready until:

1. All production business routes use Prisma repositories (no `InariStore` in the live path).
2. PostgreSQL integration, concurrency and idempotency tests pass against a real database.
3. Staging smoke (auth → purchase → POS → closing → reports) succeeds.
4. `INARI_DURABLE_CONFIRMED=1` is set only after the above evidence exists.

## Key file paths

| Path | Role |
|------|------|
| `apps/api/src/production-server.ts` | HTTP entry; auth + readiness wired |
| `apps/api/src/modules/auth/persistent-auth.ts` | DB login / session |
| `apps/api/src/infrastructure/database.ts` | Prisma client + health probe |
| `apps/api/src/infrastructure/repositories/stock-repository.ts` | Durable stock ops |
| `apps/api/prisma/schema.prisma` | Canonical schema |
| `apps/api/prisma/migrations/20261109000100_initial_database/` | Baseline migration |
| `apps/api/prisma/migrations/20261109000200_enforce_stock_target_integrity/` | Target integrity CHECKs |
| `apps/api/prisma/seed.ts` | Bootstrap admin + reference data |

## Commands

```bash
# Validate & generate
DATABASE_URL=... DIRECT_URL=... npx prisma validate --schema apps/api/prisma/schema.prisma
DATABASE_URL=... DIRECT_URL=... npx prisma generate --schema apps/api/prisma/schema.prisma

# Tests
npm run test -w @inari/api

# Migrate (staging only, after backup)
DATABASE_URL=... DIRECT_URL=... npx prisma migrate deploy --schema apps/api/prisma/schema.prisma

# Seed bootstrap admin (once)
INARI_BOOTSTRAP_ADMIN_EMAIL=... INARI_BOOTSTRAP_ADMIN_NAME=... INARI_BOOTSTRAP_ADMIN_PASSWORD=... npm run db:seed -w @inari/api
```
