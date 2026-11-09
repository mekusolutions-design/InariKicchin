# Inari Kicchin — Deployment and Operations

## Current release status

**The frontend can be prepared for preview/UAT. The API is not approved for live operations.** `production-server.ts` currently uses an in-memory demo store. It intentionally refuses to start with `NODE_ENV=production` until persistent Prisma repositories and production user provisioning are implemented and tested. Do not remove this guard as a deployment workaround.

## Frontend — Netlify

This repository is an npm-workspaces monorepo. The workspace root is the repository root; the Next.js app is `apps/web`. Configure the Netlify site as follows:

- Repository: the InariKicchin Git repository
- Base directory: repository root (`.` / leave blank)
- Package directory: `apps/web` if Netlify requests a Next.js package path; this must not change the workspace install root
- Build command (configured in `apps/web/netlify.toml`): `npm install --include=dev --workspace=@inari/web --include-workspace-root && npm run build -w @inari/web`
- Publish directory: `apps/web/.next`
- Node version: 22 (`.nvmrc`)
- Environment variable: `NEXT_PUBLIC_API_URL` set to the API origin (do not use a demo API for live operations)
- Next.js runtime: keep `@netlify/plugin-nextjs` enabled; do not force static export

The explicit workspace-targeted install selects `@inari/web` and includes the workspace root before invoking the Next.js build in that workspace. The previous Netlify attempt still failed with `next: not found`; this updated command is a corrective attempt, not a verified successful deployment. Inspect the complete install output if the error persists. A committed root `package-lock.json` is recommended but is not included because dependency installation could not complete in this isolated environment.

## API — Render configuration (deployment remains blocked by design)

The API workspace start script uses `node --import tsx`. `tsx` must therefore be in `apps/api` regular `dependencies`, not only `devDependencies`, because Render may omit development dependencies at runtime. The reconciled release candidate now declares `tsx` `^4.23.15` as a production dependency, matching the version verified in the user's local workspace. Render has now resolved this package and reached the intentional production startup guard.

Render workspace settings:

- Root directory: repository root (leave blank)
- Build command: `npm install`
- Start command: `npm run start:prod -w @inari/api`
- Node version: 22 (`.nvmrc`)
- Environment: `NODE_ENV=production`, `INARI_TOKEN_SECRET` (32+ random characters), `CORS_ORIGINS` (exact frontend origin), and database values only after Prisma integration is completed

The production seed now requires `INARI_BOOTSTRAP_ADMIN_EMAIL`, `INARI_BOOTSTRAP_ADMIN_NAME`, and a unique `INARI_BOOTSTRAP_ADMIN_PASSWORD` of at least 16 characters. Set these only in a secure secret manager and do not commit real values. The seed no longer creates known demo accounts or sample stock.

The production API is intentionally fail-closed. With the current in-memory implementation it exits at startup with a clear error. Do not change `NODE_ENV` to development or remove the guard to force a green deployment. See the blockers below.

## API — not yet production deployable

Required before API production deployment:

1. Complete Prisma-backed persistence for all domain records. The current branch now includes foundational Prisma models for orders, order lines, payments, kitchen tickets/transitions, auth sessions, idempotency and stock movements, but these models are not yet wired to the HTTP server.
2. Generate, review and validate database migrations and constraints against PostgreSQL.
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

## Production database gate

The API currently remains blocked in production because its HTTP routes still use the in-memory `InariStore`. Do not remove or bypass this guard. The shared Prisma runtime helper is infrastructure only; repositories, route migration, migrations, and PostgreSQL integration tests remain outstanding. See `DATABASE_BACKED_API_IMPLEMENTATION_REPORT.md` and `PHASE_6_DATABASE_BACKED_API_EXECUTION_PROMPT.md`.
