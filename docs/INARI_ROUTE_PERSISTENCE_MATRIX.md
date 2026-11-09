# Route Persistence Matrix

| Method | Path | Auth | Permission | Backend when DATABASE_URL set | In-memory fallback only if no DB |
|--------|------|------|------------|-------------------------------|----------------------------------|
| GET | /health | no | — | process | — |
| GET | /ready | no | — | PostgreSQL SELECT 1 | 503 |
| POST | /auth/login | no | — | persistent-auth → AuthSession | domain login |
| POST | /auth/logout | no | — | AuthSession revoke | memory logout |
| GET | /auth/demo-users | no | — | 404 when DB set | demo list |
| GET | /me | yes | — | session | session |
| GET | /dashboard | yes | dashboard:read | ReadRepository | store.dashboard |
| GET | /products | yes | products:read | ReadRepository | store.products |
| POST | /products | yes | products:write | CatalogRepository | 501 |
| GET | /orders | yes | orders:read | ReadRepository | store.orders |
| GET | /kitchen/tickets | yes | kitchen:read | ReadRepository | store.tickets |
| GET | /audit | yes | audit:read | ReadRepository | store.audit |
| GET | /reports/sales | yes | reports:read | ReadRepository | store.salesReport |
| GET | /reports/sales.csv | yes | reports:read | ReadRepository.salesReportCsv | phase4 CSV |
| GET | /reports/suppliers | yes | reports:read | ReadRepository.supplierAnalytics | phase4 analytics |
| GET | /menu | yes | menu:read | ReadRepository | store menu |
| GET | /meta | yes | — | ReadRepository | store meta |
| GET | /closings | yes | closing:read | ReadRepository | store.closings |
| GET | /makeline | yes | — | ReadRepository | store.makeline |
| GET | /suppliers | yes | — | ReadRepository | store.suppliers |
| POST | /suppliers | yes | suppliers:write | CatalogRepository | 501 |
| POST | /purchases | yes | purchases:write | StockRepository.receiveStock | store.receiveStock |
| POST | /closings | yes | closing:write | StockRepository.submitClosing | store.submitClosing |
| POST | /pos/orders | yes | pos:write | OrderRepository.createOrder | store.createOrder |
| POST | /kitchen/tickets/:id/status | yes | kitchen:write | OrderRepository.updateTicketStatus | store |
| POST | /orders/:id/void | yes | orders:void | OrderRepository.voidOrder | store |
| GET | /orders/:id/etims | yes | orders:read | ReadRepository.etimsReceipt | phase4 helper |

Transaction/idempotency: purchases, closings, POS use Serializable transactions + IdempotencyRecord where applicable.
