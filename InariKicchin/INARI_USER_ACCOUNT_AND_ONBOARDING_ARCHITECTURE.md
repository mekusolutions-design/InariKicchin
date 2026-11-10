# User account & onboarding

## Model
**Administrator-created accounts** (not public self-signup).

## Flow
1. ADMINISTRATOR opens Settings → Users → Create user
2. POST /users with fullName, email, password (≥12), role, optional phone
3. User logs in via existing /auth/login
4. Admin may deactivate via POST /users/:id/status

## Out of scope this pass (documented)
- Email invitation delivery (needs mail transport)
- Self-service forgot-password tokens
- Force password change on first login

## Security
- scrypt hashes only
- users:write not granted to MANAGER
- Role escalation to ADMINISTRATOR restricted to administrators
