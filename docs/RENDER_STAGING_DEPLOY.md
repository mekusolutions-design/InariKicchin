# Render Staging Deploy Guide

## Fix for: `@prisma/client did not initialize yet`

Render installs packages but does **not** run `prisma generate` unless you tell it to.
This package now:

1. Puts `prisma` in **dependencies** (not only devDependencies).
2. Runs `prisma generate` on **postinstall**.
3. Runs `prisma generate` again at the start of **start:prod**.

## Recommended Render settings

| Setting | Value |
|---------|--------|
| Root Directory | *(repo root)* |
| Build Command | `npm install` |
| Start Command | `npm run start:prod -w @inari/api` |
| Node | 22 |

Alternative explicit build (safest):

```text
Build Command:  npm install && npx prisma generate --schema apps/api/prisma/schema.prisma
Start Command:  npm run start:prod -w @inari/api
```

## Required environment variables

| Variable | Required |
|----------|----------|
| `DATABASE_URL` | Yes — Supabase pooler URL |
| `DIRECT_URL` | Yes — Supabase direct URL |
| `INARI_TOKEN_SECRET` | Yes — ≥ 32 characters |
| `CORS_ORIGINS` | Yes — Netlify origin(s) |
| `NODE_ENV` | `production` |
| `INARI_DURABLE_CONFIRMED` | Leave unset until smoke tests pass |

### Name mapping

If you only set `JWT_SECRET` / `CORS_ORIGIN`, also set:

- `INARI_TOKEN_SECRET` = same value as JWT secret  
- `CORS_ORIGINS` = same value as CORS_ORIGIN  

## After deploy

```bash
curl -sS https://<host>/health
curl -sS https://<host>/ready
# expect: ready true, storage postgresql
```

## Do not use `npm audit fix --force` on deploy

That can break the lockfile. Ignore audit noise on Render unless you intentionally upgrade deps in a PR.

## Production confirm flag

Only after health, ready, login, purchase, POS, and reports work:

```text
INARI_DURABLE_CONFIRMED=1
```

Then restart the service.
