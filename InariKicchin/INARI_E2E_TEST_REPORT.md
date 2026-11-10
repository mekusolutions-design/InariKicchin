# E2E test report

## Environment
- Staging API: **unavailable** (`https://inarikicchin.onrender.com` → no-server)
- Therefore browser workflows against live staging could not be executed

## Code-path verification performed
- Reports response normalization unit-style review
- Settings meta normalization review
- Kitchen line field fallback (`name` | `nameSnapshot`)
- Contract parity between `store.salesReport` and durable `salesReport`

## Required after Render redeploy
1. Login as manager
2. Open Reports → Apply date range → confirm KPIs non-error
3. Export CSV downloads
4. Open Settings → Users / VAT / Payments / Order types populate
5. POS complete order → kitchen ticket appears within 15s
6. Closing submit → history lists snapshot
