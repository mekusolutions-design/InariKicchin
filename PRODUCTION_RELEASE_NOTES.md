# Inari Kicchin release candidate notes

This archive is a **hardened development/UAT release candidate**, not an approved production release.

Read first:
- `docs/PRODUCTION_READINESS_REPORT.md`
- `docs/PRODUCTION_READINESS_PROMPT.md`
- `docs/DEPLOYMENT.md`

The API intentionally refuses `NODE_ENV=production` because the current HTTP service uses process-local in-memory demo data. Do not bypass this gate. Implement and test Prisma-backed persistence and secure owner provisioning first.

Verified in this environment:
- 42 domain tests passed.
- Local API liveness endpoint responded successfully.
- Readiness endpoint returned 503 and identified in-memory storage.
- Configured CORS origin was accepted; an unlisted origin received no allow-origin header.
- Production API startup was blocked as designed.

Not verified: Next.js production build, Prisma/database integration, backup restore, deployed services, and browser end-to-end workflows.


## Deployment reconciliation and additional hardening — 9 November 2026

- Netlify build now explicitly installs the `@inari/web` npm workspace and builds that workspace; the prior `next: not found` failure remains unverified until a fresh Netlify deploy succeeds.
- API `tsx` runtime dependency is `^4.23.15` in regular dependencies, matching the user's local `npm ls` output. Render now reaches the intentional production persistence guard.
- Removed prefilled demo credentials from the web login page.
- Replaced the Prisma seed's hardcoded administrator and manager credentials with explicit secure environment-based first-admin provisioning. Removed sample stock/product/supplier creation from the production seed.
- Added a production-startup-guard regression test. The API test suite now reports 43 passing tests.
- Added an API persistence gap analysis. Database persistence, migrations, full transactional models, and route migration remain outstanding; release remains NO-GO for live operations.
