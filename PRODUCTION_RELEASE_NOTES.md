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
