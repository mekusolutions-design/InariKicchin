# Deploy notes

This environment cannot authenticate to your Render or Netlify accounts.
Deploy by pushing this codebase to the connected GitHub repo, or by uploading the release zip and triggering a manual deploy.

**API host to use:** `https://inarikicchin-api.onrender.com`  
(Older `inarikicchin.onrender.com` returned no-server.)

See `docs/STAGING_DEPLOY_CHECKLIST.md` for the full checklist.

## Netlify web build (2026-11-10 fix)

Failure was TypeScript:

```
dashboard/page.tsx: Property 'module_low_stock_alerts' does not exist on type 'Record<string, string> | {}'
```

Cause: `.catch(() => ({}))` inferred `{}` under strict checking.

Fixes applied:
- All settings `.catch(() => ({} as Record<string, string>))`
- Safer `e instanceof Error` in catch handlers
- Role state via `useEffect` (no window access during render)
- Root `scripts/postinstall.mjs` skips Prisma on Netlify / when CLI missing
- `SKIP_PRISMA_GENERATE=1` in netlify.toml
- Added `apps/web/tsconfig.json` and proper `next-env.d.ts`

Redeploy after pushing these changes. Ensure Netlify env:
- `NEXT_PUBLIC_API_URL` = production API base URL
- `NPM_CONFIG_PRODUCTION=false` (already in toml)
