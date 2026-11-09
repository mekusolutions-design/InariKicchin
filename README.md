# Inari Kicchin — Restaurant Management System

This repository contains a Next.js web application and a TypeScript API prototype aligned to the supplied Restaurant Management System Blueprint v1.0.

## Current release status

**Not approved for live restaurant operations.** The API currently uses an in-memory demo store. It intentionally refuses to start with `NODE_ENV=production` until persistent Prisma-backed repositories, complete transactional data models and secure production user provisioning are implemented and tested.

Read these documents before running or deploying:

- `PRODUCTION_RELEASE_NOTES.md`
- `docs/PRODUCTION_READINESS_REPORT.md`
- `docs/PRODUCTION_READINESS_PROMPT.md`
- `docs/DEPLOYMENT.md`
- `docs/Restaurant_Management_System_Blueprint_v1.0.pdf`

## Applications

| App | Stack | Local port |
|---|---|---:|
| `apps/web` | Next.js 15 App Router, React 19, TypeScript, Tailwind | 3001 |
| `apps/api` | TypeScript domain logic and Node HTTP API | 4040 |

## Local development

Use Node.js 22. Configure a local API secret before starting the API:

```powershell
cd apps/api
$env:NODE_ENV = "development"
$env:INARI_TOKEN_SECRET = "replace-with-a-random-secret-at-least-32-characters"
$env:CORS_ORIGINS = "http://localhost:3001"
npm install
npm run start:prod
```

In another terminal:

```powershell
cd apps/web
Copy-Item .env.example .env.local
npm install
npm run dev
```

The API is an in-memory development/demo service. `/health` reports process liveness; `/ready` returns 503 because durable storage is not connected. Do not use it for real restaurant transactions.

## Tests

```powershell
cd apps/api
node --experimental-strip-types --test src/domain/stock/calculations.node-test.ts src/domain/stock/units.node-test.ts src/domain/vat/calculations.node-test.ts src/domain/store.node-test.ts src/domain/phase4.node-test.ts src/domain/auth.node-test.ts
```

## Deployment

The frontend has Netlify build configuration in `apps/web/netlify.toml`. Deploying the frontend does not make the API production-ready. See `docs/DEPLOYMENT.md` and do not bypass the API's production startup guard.
