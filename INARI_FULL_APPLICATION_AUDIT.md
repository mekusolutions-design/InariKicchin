# InariKicchin — Full Application Audit

**Date:** 2026-11-09  
**Scope:** Frontend (`apps/web`) ↔ API (`apps/api`) ↔ PostgreSQL (Prisma)

## Staging probe

| Target | Result |
|--------|--------|
| `https://inarikicchin.onrender.com` | HTTP 404 / `x-render-routing: no-server` — **API service not running** |
| `https://inarikicchin.netlify.app` | Next.js shell loads (error document when API URL missing/unavailable) |

**Blocker:** Live staging API is offline. Code fixes below are verified by contract analysis and static review; re-deploy Render and re-run smoke tests before calling features “verified on staging”.

## Frontend → backend route matrix

| Screen | User action | Method | Path | Backend | Auth / permission | Status after fix |
|--------|-------------|--------|------|---------|-------------------|------------------|
| Login | Sign in | POST | `/auth/login` | persistent-auth or store | Public | Working |
| Logout | Sign out | POST | `/auth/logout` | persistent-auth or store | Bearer | Working |
| Me | Session | GET | `/me` | auth | Bearer | Working |
| Dashboard | Load KPIs | GET | `/dashboard` | ReadRepository / store | `dashboard:read` | **Contract aligned** (lowStock onHand/min, lastClosing*, stockReceivedToday) |
| Products | List | GET | `/products` | ReadRepository | `products:read` | Working |
| Inventory Received | Submit receipt | POST | `/purchases` | StockRepository | `purchases:write` | Working when durable |
| Inventory Received | History | GET | `/purchases` | **Not registered** | — | Partial — frontend tolerates empty |
| Makeline | List / produce | GET/POST | `/makeline` | ReadRepository / StockRepository | auth / write | Working |
| Closing Stock | List / submit | GET/POST | `/closings` | ReadRepository / StockRepository | `closing:read/write` | Working |
| Stock History | List | GET | `/closings` | ReadRepository | `closing:read` | Working |
| Menu | List | GET | `/menu` | ReadRepository | `menu:read` | Working |
| POS | Meta (types) | GET | `/meta` | ReadRepository | Bearer | **Contract aligned** |
| POS | Checkout | POST | `/pos/orders` | OrderRepository | `pos:write` | Working |
| Kitchen | Tickets | GET | `/kitchen/tickets` | ReadRepository | `kitchen:read` | Working |
| Kitchen | Status | POST | `/kitchen/tickets/:id/status` | OrderRepository | `kitchen:write` | Working |
| Orders | List | GET | `/orders` | ReadRepository | `orders:read` | Working |
| Reports | Sales | GET | `/reports/sales` | ReadRepository | `reports:read` | **Contract aligned** (grossSales, vatCollected, netSales, orders count) |
| Reports | CSV | GET | `/reports/sales.csv` | ReadRepository | `reports:read` | Working — frontend export wired |
| Reports | Suppliers | GET | `/reports/suppliers` | ReadRepository | `reports:read` | Backend exists; UI optional |
| Settings | Config + users | GET | `/meta` | ReadRepository | Bearer | **Contract aligned** (users, ratePercent, enabled) |
| Suppliers | List | GET | `/suppliers` | ReadRepository | Bearer | Working |
| Suppliers | Create | POST | `/suppliers` | CatalogRepository | `suppliers:write` | Durable only |
| Products | Create | POST | `/products` | CatalogRepository | `products:write` | Durable only |
| Health | Probe | GET | `/health` | production-server | Public | Working when process up |
| Ready | Probe | GET | `/ready` | production-server + DB | Public | Working when DB up |

## Root causes of Reports / Settings failures

1. **Response shape mismatch (primary code defect)**  
   - Durable `ReadRepository.salesReport` returned `{ orderCount, totalSales, totalVat, orders:[] }` while the UI expected `{ orders, grossSales, vatCollected, netSales }`.  
   - Durable `ReadRepository.meta` omitted `users` and exposed `vat.rate` (0–1) instead of `vat.ratePercent` / `enabled`.

2. **Staging API offline**  
   - Render reports `no-server`. Even correct contracts cannot succeed until the service is redeployed with `DATABASE_URL`, `INARI_TOKEN_SECRET`, and `CORS_ORIGINS` including the Netlify origin.

3. **Purchase history**  
   - Frontend optionally calls `GET /purchases`; production-server only implements `POST /purchases`. UI already degrades gracefully.

## Permissions note

- `reports:read` and `settings:read` are granted to ADMINISTRATOR and MANAGER, not CASHIER.  
- Cashiers will see Forbidden on Reports if they open the page — expected.

## Real-time assessment

- Kitchen polls every 15s; POS does not push tickets.  
- WebSockets not present. Recommended: keep polling for v1; optional SSE later if multi-kitchen latency becomes an issue. Multi-instance Render would need shared pub/sub for true sockets — unjustified until staging is stable.
