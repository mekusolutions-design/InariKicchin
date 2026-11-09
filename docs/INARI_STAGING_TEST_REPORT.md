# InariKicchin Staging Test Report
**Date:** 9 November 2026

## Commands executed

```bash
npx prisma validate
npx prisma migrate deploy
npx tsx prisma/seed.ts   # via DIRECT_URL
npm run test -w @inari/api
DATABASE_URL=$DIRECT_URL node --import tsx --test src/infrastructure/repositories/integration.node-test.ts
```

## Results

### Unit / schema (local)
- Domain unit tests: **46 pass**
- Schema contract tests: **7 pass**
- Total: **53 pass, 0 fail**

### PostgreSQL integration (Supabase staging via DIRECT_URL)
| Test | Result |
|------|--------|
| persistent login/logout | PASS |
| receive stock + WAC atomic | PASS |
| POS order + kitchen transition + void + idempotency | PASS |
| read repository dashboard/products | PASS |

**4 pass, 0 fail** against live Supabase.

### Not executed in this session
- Render staging HTTP smoke (`https://inarikicchin.onrender.com`) after redeploy
- Netlify browser E2E
- Concurrent multi-process load suite
- Next.js production build (optional operator step)

## Persistence evidence
- Migrations present in `_prisma_migrations` on Supabase.
- Integration tests created products, purchases, orders, tickets and verified reads on independent queries.
