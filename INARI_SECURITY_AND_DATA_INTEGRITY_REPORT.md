# Security and data integrity

## Controls verified in code
- Bearer session auth; persistent sessions when DATABASE_URL set
- Role permissions via assertPermission (ADMINISTRATOR *, MANAGER, CASHIER, KITCHEN_STAFF)
- Reports/PDF/CSV require reports:read
- Production refuses start without DATABASE_URL and INARI_TOKEN_SECRET ≥ 32 chars
- /ready distinguishes postgresql vs in-memory
- Password hashing scrypt in seed/persistent-auth
- Login attempt lockout model AuthLoginAttempt
- Request body size limit 1MB
- CORS allowlist via CORS_ORIGINS
- No password hashes in /meta users list

## Residual risks
- Staging durableConfirmed still false until operator smoke
- Settings writes not exposed (reduces privilege escalation surface)
- PDF/CSV inherit auth of requester — must keep CORS + token strict on Netlify origin

## Data integrity
- ClosingStatus enum strict (SUBMITTED only for “posted”)
- Prisma Decimal for money/qty fields
- Idempotency keys on POS and closings
