# Root cause and fix — Settings, Closing Stock, Cashier reports, Kitchen tickets

## Symptoms
1. Settings save: `prisma.systemSetting.upsert` → Transaction not found (PgBouncer).
2. Closing Stock: `prisma.wastageRecord.findMany` → same error inside interactive `$transaction`.
3. Cashier could see POS Order Reports in nav but API required `reports:read` (was missing on CASHIER).
4. Kitchen staff must see Kitchen Tickets (nav + permissions verified).

## Root cause
Supabase pooler (`DATABASE_URL`, port 6543, PgBouncer) does not support Prisma interactive transactions. `$transaction(async (tx) => …)` fails with “Transaction ID is invalid / old closed transaction”.

## Fixes
1. `database.ts` — `getTransactionalPrismaClient()` uses `DIRECT_URL` when set.
2. `StockRepository` / `OrderRepository` — interactive transactions use `txClient()` → direct connection.
3. `putSettings` — sequential upserts (no interactive transaction); pooler-safe.
4. `auth.ts` — CASHIER gains `reports:read` for POS Order Reports / reprint.
5. Nav already includes Kitchen Tickets for `KITCHEN_STAFF` and POS Order Reports for `CASHIER`.

## Render env
- `DATABASE_URL` = pooler URL
- `DIRECT_URL` = direct `:5432` URL (required for stock/POS transactions)
- `CORS_ORIGINS` = `https://inarikicchin.netlify.app`
