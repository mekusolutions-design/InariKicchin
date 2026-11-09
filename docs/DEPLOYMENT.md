# Inari Kicchin — Deployment and Operations

## Current release status

**The frontend can be prepared for preview/UAT. The API is not approved for live operations.** `production-server.ts` currently uses an in-memory demo store. It intentionally refuses to start with `NODE_ENV=production` until persistent Prisma repositories and production user provisioning are implemented and tested. Do not remove this guard as a deployment workaround.

## Frontend — Netlify

Configure the Netlify site:

- Repository: the InariKicchin Git repository
- Base directory: `apps/web`
- Build command: `npm run build`
- Node version: 22 (`.nvmrc` / `netlify.toml`)
- Environment variable: `NEXT_PUBLIC_API_URL`

Netlify's supported Next.js runtime should be used; do not force static export. Run a successful local production build before connecting a production domain. Do not point the public website at the demo API for real business activity.

## API — not yet production deployable

Required before API production deployment:

1. Implement Prisma-backed persistence for all domain records, including sales/orders, lines, payments, kitchen tickets, idempotency and audit history.
2. Add and review database migrations and constraints.
3. Implement atomic transaction boundaries for business workflows.
4. Implement production owner bootstrap with no known demo credentials.
5. Replace process-local session and lockout state with a shared/durable mechanism.
6. Add runtime request validation, rate limiting, structured logging and observability.
7. Verify backup and restore.
8. Complete integration and end-to-end tests.

## Local development API

```powershell
cd apps/api
$env:NODE_ENV = "development"
$env:INARI_TOKEN_SECRET = "replace-with-a-random-secret-at-least-32-characters"
$env:CORS_ORIGINS = "http://localhost:3001"
npm install
npm run start:prod
```

The API is an in-memory development/demo server. `/health` is a liveness endpoint; `/ready` returns 503 because storage is not durable.

## Local web

```powershell
cd apps/web
Copy-Item .env.example .env.local
npm install
npm run dev
```

Set `NEXT_PUBLIC_API_URL` to the local API URL for development only.

## Secrets

- Never commit `.env` files.
- Use hosting-provider secret storage for server secrets.
- `NEXT_PUBLIC_*` variables are exposed to the browser and must never contain credentials.
- Generate `INARI_TOKEN_SECRET` with a cryptographically secure random generator; use 32+ characters.
- Do not use the documented demo credentials for production.

## Release rollback

- Keep the previous frontend and API release artifacts.
- Back up the database before every production migration.
- Test restore on a separate database before relying on the backup.
- Apply migrations using a reviewed forward migration; do not reset production data.
- Roll back application code only when schema compatibility is confirmed. Restore data only under an approved incident procedure.
