# Deep product gap audit (Blueprint v1.0)

**API staging:** `https://inarikicchin-api.onrender.com` — `/health` ok, `/ready` postgresql  
**Frontend:** `https://inarikicchin.netlify.app`

## Critical gaps closed this pass
| Gap | Fix |
|-----|-----|
| ClosingStatus `LOCKED` invalid | Queries use `SUBMITTED` only |
| Reports JSON contract mismatch | `grossSales` / `vatCollected` / `netSales` / `orders` |
| Settings meta missing users / ratePercent | `meta()` returns users + ratePercent |
| No PDF report | `GET /reports/sales.pdf` + UI Export PDF |
| No purchase history API | `GET /purchases` via ReadRepository |

## Remaining gaps (prioritised)
| Priority | Item | Notes |
|----------|------|-------|
| P1 | Redeploy API with ClosingStatus + PDF + GET purchases | Code fixed; must deploy to Render |
| P1 | Netlify `NEXT_PUBLIC_API_URL` must be `https://inarikicchin-api.onrender.com` | Old hostname returned no-server |
| P2 | Settings write (VAT rate, order types, payment methods) | Currently read-only from `/meta` |
| P2 | Menu item create/edit UI | Catalog create exists as POST /products; menu items need dedicated routes if required |
| P2 | Stock history from stock movements ledger | Closings list is partial; full movement filter not yet UI-complete |
| P3 | Real-time kitchen | Polling retained intentionally |
| P3 | eTIMS / M-Pesa live integrations | Stubs / placeholders only — do not present as live |

## Blueprint screens vs status
| Screen | Operational? | Notes |
|--------|--------------|-------|
| Dashboard | Yes (after deploy) | Real PG aggregates |
| Inventory Received | Yes | Supplier, invoice, date, expiry, notes, unit price |
| Makeline | Yes | List + production POST |
| Closing Stock | Yes | Submit + history |
| Stock History | Partial | Closings-based |
| Menu | Read | Management writes limited |
| POS | Yes | Contract `{ order, ticket }` |
| Kitchen | Yes | Status transitions |
| Reports | Yes after deploy | CSV + PDF |
| Suppliers | List + create | Edit limited |
| Settings | Read | Write deferred |
