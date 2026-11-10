# Staging verification

## Observed 2026-11-10
| Check | Result |
|-------|--------|
| https://inarikicchin-api.onrender.com/health | ok, phase 5 |
| /ready | postgresql, durableConfirmed false |
| /reports/sales.pdf on live | 404 — **new code not deployed yet** |
| https://inarikicchin.onrender.com | historical no-server; use **-api** host |
| Netlify | Must set NEXT_PUBLIC_API_URL to api host |

## Post-deploy smoke checklist
1. Manager login
2. Dashboard loads KPIs without Prisma enum errors
3. Reports Apply + CSV + PDF download
4. Suppliers create
5. Inventory receive
6. POS complete → kitchen ticket
7. Kitchen status update
8. Closing submit
9. Stock History movements tab
10. Settings /meta users + VAT
