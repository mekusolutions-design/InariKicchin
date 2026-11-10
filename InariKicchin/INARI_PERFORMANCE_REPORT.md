# Performance report

## Baseline constraints
Live staging API returned `no-server`; quantitative p95 measurements against Render were **not** obtainable in this session.

## Code-level findings
| Area | Observation | Action |
|------|-------------|--------|
| Reports | Previously returned full order arrays as `orders` | Count + summary primary; detail in `orderRows` for CSV only |
| Dashboard | Parallel Prisma queries | Already `Promise.all` for orders/products/wastage/tickets/closing/purchases |
| Meta | Parallel order types / payments / VAT / users | Parallel |
| Frontend Reports | Duplicate risk on date change | Single load on Apply |
| Kitchen | 15s interval | Acceptable; avoid sub-second polling |
| POS tiles | Client-side filter | No extra API calls per keystroke |

## Recommendations after redeploy
1. Measure `/dashboard`, `/reports/sales`, `/pos/orders`, `/kitchen/tickets` p50/p95 via Render metrics or `curl -w`.
2. Add DB indexes only if EXPLAIN shows sequential scans on hot filters (`restaurant_order.created_at`, `stock_closing_session.submitted_at`).
3. Keep Netlify region and Render region aligned to reduce RTT.

## Status
**Investigated; targeted contract/payload improvements applied.** Quantitative before/after requires live staging.
