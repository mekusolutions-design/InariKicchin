# Blueprint requirements traceability (v1.0)

| Requirement | Blueprint | Implementation | Gap | Evidence |
|-------------|-----------|----------------|-----|----------|
| Dashboard KPIs from live data | §14.2 | GET /dashboard via ReadRepository | Charts optional series | Code + staging PG ready |
| Inventory receipt fields | §14.3 | Product, supplier, qty, total, invoice, date, expiry, notes | Tax line not separate | inventory-received page + POST /purchases |
| Unit price = total/qty | §4 | Client live calc + server WAC | — | Form unitPrice panel |
| Makeline production | §6, §14.4 | GET/POST /makeline | Recipe auto-deduction phase4 | stock-repository |
| Stock closing equation | §5, §14 | POST /closings StockRepository | — | Domain calculations preserved |
| Closing snapshots immutable | §5 | SUBMITTED status; SUPERSEDED on correct | — | enum ClosingStatus |
| Stock history | §14 | Closings + GET /stock/movements | Deep product filter P2 | stock-history page |
| Menu list | §7, §14 | GET /menu | Full CRUD limited | menu page |
| POS cart + VAT + payment | §8, §14 | POST /pos/orders {order,ticket} | — | pos page + OrderRepository |
| Kitchen status transitions | §9 | POST /kitchen/tickets/:id/status | Polling not WS | kitchen-tickets |
| Reports sales + filters | §10 | GET /reports/sales | — | Reports page |
| CSV export | §10 | GET /reports/sales.csv | — | Implemented |
| PDF export | §10 / directive | GET /reports/sales.pdf | **Deploy required** | pdf-sales.ts |
| Suppliers master | §3 | GET/POST /suppliers | Edit limited | suppliers page |
| Settings VAT/users/types | §11–12 | GET /meta | Writes deferred (documented) | settings page |
| Roles/permissions | §11 | assertPermission | — | auth.ts |
| WAC costing | §4 | stock calculations domain | — | domain/stock |
| Audit log | §13 | auditLog writes on mutations | — | repositories |
| Idempotency POS | §8 | Idempotency-Key | — | order-repository |
| Health/ready | ops | /health /ready | — | Live probe 2026-11-10 |
