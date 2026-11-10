# Final baseline & implementation audit

**Baseline ZIP:** InariKicchin-Remaining-Features-2.zip  
**Date:** 10 Nov 2026

## Verified present before this pass
- Durable Prisma repositories (stock, orders, read)
- Typeahead inventory/makeline (frontend)
- POST /makeline, /makeline/products
- Settings GET/PUT SystemSetting
- POS Order Reports + day close API/page
- Receipt page `/receipts/[id]`
- Delivery POS payment classification
- ClosingStatus SUBMITTED (no LOCKED)

## Defects / gaps addressed this pass
| Item | Action |
|------|--------|
| Manager PIN for voids | PUT `/settings/manager-pin` + void requires PIN (non-admin) |
| Order-type management | GET/POST `/order-types`, PUT `/order-types/:id` + Settings UI |
| User create | POST `/users`, POST `/users/:id/status` + Settings form |
| users:write | Admin-only via `*` permission |

## Still open / blocked
- Stock clerk role (not in RoleName enum — would need migration)
- Commission % column on OrderType (not in schema — deferred)
- Full module-switch enforcement on every POS code path
- Physical printer validation
- Live staging E2E (deploy required)
- Concurrent receipt-number stress test on staging

## Staging hosts
Confirm at deploy time: `inarikicchin-api.onrender.com` vs `inarikicchin.onrender.com`.
