# Settings module — completion report

## Problem
Settings page failed to load usable configuration from the API.

## Causes
1. Durable `ReadRepository.meta()` did not return `users`.
2. VAT payload used `rate` (fraction) without `ratePercent` / `enabled` expected by the UI.
3. Staging API offline.

## Fixes applied
### Backend — `meta()`
Returns:
- `orderTypes[]` with name / isDelivery / requiresReference
- `paymentMethods[]` (names)
- `vat.enabled`, `vat.ratePercent`, `vat.rate`, `vat.pricesIncludeVat`
- `users[]` with id, fullName, email, role (active users only)
- `durable: true`

### Frontend — settings page
- Normalizes both durable and in-memory meta shapes
- Clear empty states for users / methods / types
- Read-only presentation (no fake save)

## Security
- `/meta` requires authentication
- Password hashes never returned
- No privilege escalation paths introduced
- Write endpoints for user/VAT mutation remain out of scope unless explicitly added later

## Status
**Implemented and code-verified.** Staging verification pending Render redeploy.
