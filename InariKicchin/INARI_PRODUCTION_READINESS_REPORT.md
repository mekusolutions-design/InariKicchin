# Production readiness assessment

## Recommendation: **NO-GO for production**

### Blockers
1. Staging API not serving (`Render no-server`)
2. Live end-to-end verification of Reports/Settings not completed against PostgreSQL
3. `INARI_DURABLE_CONFIRMED=1` must only be set after successful staging smoke tests

### Completed in this pass
- Reports and Settings API contracts aligned with frontend
- Dashboard durable payload aligned with UI fields
- Kitchen line naming resilience
- Audit and module completion documentation
- Real-time decision documented (polling retained)

### Required before GO
1. Redeploy API on Render with `DATABASE_URL`, `DIRECT_URL`, `INARI_TOKEN_SECRET`, `CORS_ORIGINS=https://inarikicchin.netlify.app`
2. Confirm `/health` and `/ready` return 200 with `storage: postgresql`
3. Run manager login → Reports → Settings → POS → Kitchen → Closing smoke
4. Confirm no console/network errors on Netlify
5. Optionally set `INARI_DURABLE_CONFIRMED=1` after those smokes

Production remains untouched.
