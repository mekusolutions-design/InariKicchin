# Inari Kicchin — Client Deployment Guide (RestFlow)

This repository has been configured for a **separate Inari Kicchin** deployment.
Internal product identity remains RestFlow; client-facing name is **Inari Kicchin**.

## What changed

### Client identity
- Web `APP_NAME` → **Inari Kicchin**
- Browser title / metadata → Inari Kicchin
- Mobile display name → **Inari Kicchin**
- Mobile slug → `inari-kicchin`
- Mobile package / bundle identifiers → `com.inarikicchin.app`
- EAS projectId placeholder → must be replaced with a dedicated Expo project
- Login placeholders and titles updated
- Hard-coded SukariBurgers production API URLs removed from `eas.json`

### Web UI (modest refinements)
- Selection highlight softened
- Table header weight and spacing improved for scanability
- StatCard icon treatment moved to neutral surface (less uniform green)
- Dashboard content area given slightly more vertical breathing room
- Utility classes `ops-page` / `ops-section` added for consistent operational layout

### Unchanged (by design)
- All business logic, inventory costing, event sourcing, projections
- Auth, roles, permissions, shop scoping
- API contracts, Prisma schema, migrations
- Payment, tax, offline queues, idempotency
- Existing RestFlow internal package names and storage key prefixes

## Required environment variables

### Web (`apps/web`)
| Variable | Description | Example placeholder |
|----------|-------------|---------------------|
| `NEXT_PUBLIC_API_URL` | Nest API base URL | `https://YOUR-INARI-API-HOST.example.com` |
| `NEXT_PUBLIC_POS_API_URL` | Optional Go POS API | `https://YOUR-INARI-POS-API-HOST.example.com` |
| `NEXT_PUBLIC_USE_GO_POS` | Route POS to Go when set | `true` / `false` |
| `NEXT_PUBLIC_WS_URL` | Optional WebSocket base | defaults to API URL |
| `NEXT_PUBLIC_APP_ENV` | `development` \| `staging` \| `production` | `production` |

See `apps/web/.env.example`.

### API (`apps/api`)
| Variable | Description | Notes |
|----------|-------------|-------|
| `DATABASE_URL` | PostgreSQL for **Inari Kicchin only** | Never reuse another client DB |
| `JWT_SECRET` | Strong secret | Required in production |
| `CORS_ORIGIN` | Allowed web origin(s) | Set to Inari web URL in prod |
| `PORT` | API port | default 3000 |
| `BASE_URL` | Public API URL | for webhooks |

See `apps/api/.env.example`.

### Mobile (`apps/mobile`)
Set via EAS build profiles in `eas.json` or `eas secret`:
- `EXPO_PUBLIC_API_URL`
- `EXPO_PUBLIC_POS_API_URL` (optional)
- `EXPO_PUBLIC_USE_GO_POS`

**Do not** leave SukariBurgers production hosts in any Inari build profile.

## Deployment prerequisites (must supply)

1. **Dedicated PostgreSQL database** for Inari Kicchin (new instance or isolated schema).
2. **API host** (Render / DigitalOcean / similar) with `DATABASE_URL` and `JWT_SECRET`.
3. **Web host** (Netlify / Vercel) with `NEXT_PUBLIC_API_URL` pointing at the Inari API.
4. **New Expo / EAS project** for Inari Kicchin:
   - Create project → replace `REPLACE_WITH_INARI_EAS_PROJECT_ID` in `app.json`
   - Update package/bundle IDs already set to `com.inarikicchin.app`
5. Optional: custom logo / adaptive icons / splash if branding assets are provided.
6. Optional: separate Go POS service if using the strangler pattern.

## Local verification commands

From monorepo root (pnpm preferred where available):

```bash
# Web
cd apps/web
npm install          # or pnpm install if using workspace
npm run typecheck
npm run lint
npm run build

# API
cd apps/api
npm install
npm run prisma:generate
npm run build
# npm test           # when test env / DB available

# Mobile typecheck
cd apps/mobile
npm install
npx tsc --noEmit
```

## Deployment checklist

- [ ] Create isolated Inari Kicchin database; run migrations from `apps/api`
- [ ] Deploy API with Inari `DATABASE_URL` + `JWT_SECRET` + `CORS_ORIGIN`
- [ ] Deploy web with `NEXT_PUBLIC_API_URL` = Inari API
- [ ] Confirm no SukariBurgers URLs remain in Inari env / EAS profiles
- [ ] Create dedicated EAS project; set real `projectId`
- [ ] Build mobile preview/production against Inari API hosts
- [ ] Smoke-test: login, inventory list, receive, POS, waste, dashboard
- [ ] Verify shop isolation and role permissions still enforce correctly

## Rollback

- Web: revert `APP_NAME` / metadata / UI token tweaks; redeploy previous build.
- Mobile: restore previous `app.json` / `eas.json` and rebuild.
- Never point Inari env vars at another client’s database or vice versa.

## Remaining blocked / unverified

- Full test suite and e2e require a running database and seeded data (not available in this environment).
- Production hosts, credentials, and EAS project ID are placeholders until supplied.
- Logo / favicon / splash remain the existing RestFlow abstract mark until Inari assets are provided.
