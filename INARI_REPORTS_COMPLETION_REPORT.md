# Reports module — completion report

## Problem
Frontend Reports page could not render backend data successfully.

## Causes
1. Durable `ReadRepository.salesReport` response shape did not match the established UI/store contract.
2. Staging API process was not serving traffic (`no-server` on Render).

## Fixes applied
### Backend — `apps/api/src/infrastructure/repositories/read-repository.ts`
`salesReport(from, to)` now returns:
- `orders` (count)
- `grossSales`, `vatCollected`, `netSales`, `averageOrder`
- `byOrderType`
- `stockUsedValue`, `wastageValue` (from submitted closings in range)
- `note`
- Detail retained as `orderRows` for CSV

CSV export uses `orderRows`.

### Frontend — `apps/web/src/app/(app)/reports/page.tsx`
- Normalizes both legacy durable shapes and the corrected shape
- Working **Export CSV** via `/reports/sales.csv` with Bearer token
- Displays stock used / wastage and by-order-type breakdown when present

## Data sources
- Orders: `RestaurantOrder` (+ payments, lines) filtered by `created_at` and non-CANCELLED
- Stock used / wastage: `StockClosingSession` where status SUBMITTED|LOCKED in date range

## Permissions
`reports:read` — ADMINISTRATOR, MANAGER

## Tests
- Static contract alignment verified against in-memory `store.salesReport`
- Live staging verification **blocked** (Render API offline)

## Status
**Implemented and code-verified.** Staging verification pending Render redeploy.
