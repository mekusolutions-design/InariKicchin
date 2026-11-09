# Route Persistence Matrix

| Method | Path | Auth | Permission | When DATABASE_URL set | Notes |
|--------|------|------|------------|----------------------|-------|
| GET | /health | no | — | process | |
| GET | /ready | no | — | PostgreSQL SELECT 1 | reports durableConfirmed |
| POST | /auth/login | no | — | AuthSession | |
| POST | /auth/logout | no | — | session revoke | |
| GET | /me | yes | — | session | |
| GET | /dashboard | yes | dashboard:read | ReadRepository | |
| GET | /products | yes | products:read | ReadRepository | |
| POST | /products | yes | products:write | CatalogRepository | |
| GET | /suppliers | yes | — | ReadRepository | |
| POST | /suppliers | yes | suppliers:write | CatalogRepository | |
| GET | /menu | yes | menu:read | ReadRepository | |
| GET | /meta | yes | — | ReadRepository | |
| GET | /makeline | yes | — | ReadRepository | |
| GET | /orders | yes | orders:read | ReadRepository | |
| GET | /kitchen/tickets | yes | kitchen:read | ReadRepository | |
| GET | /closings | yes | closing:read | ReadRepository | |
| GET | /audit | yes | audit:read | ReadRepository | |
| GET | /reports/sales | yes | reports:read | ReadRepository | |
| GET | /reports/sales.csv | yes | reports:read | ReadRepository.salesReportCsv | |
| GET | /reports/suppliers | yes | reports:read | ReadRepository.supplierAnalytics | |
| POST | /purchases | yes | purchases:write | StockRepository | Serializable |
| POST | /closings | yes | closing:write | StockRepository | Serializable + idempotency |
| POST | /pos/orders | yes | pos:write | OrderRepository | returns `{order,ticket}` |
| POST | /kitchen/tickets/:id/status | yes | kitchen:write | OrderRepository | |
| POST | /orders/:id/void | yes | orders:void | OrderRepository | |
| GET | /orders/:id/etims | yes | orders:read | ReadRepository.etimsReceipt | prep only |
