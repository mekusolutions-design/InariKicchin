# Screen-by-screen deep audit

| Module | Expected | Current | Gaps | Severity | Status |
|--------|----------|---------|------|----------|--------|
| Dashboard | Live KPIs, low stock, closing, kitchen | PG aggregates | Optional hour charts | Med | Operational |
| Inventory Received | Full receipt form + history | Fields + POST + GET history | Multi-line receipt UI | Med | Operational |
| Makeline | Produce + history | List + POST | Recipe deduction UI | Med | Operational |
| Closing Stock | Count + submit | Tables + POST | Period picker polish | Low | Operational |
| Stock History | Closings + ledger | Closings + movements + filter | Running balance | Med | Improved |
| Menu | List + manage | Read list | Full menu CRUD | Med | Partial |
| POS | Cart, pay, ticket | Full flow + idempotency | Split pay | Low | Operational |
| Kitchen | Status board | Poll + transitions | Realtime optional | Low | Operational |
| Reports | Filters, CSV, PDF | JSON+CSV+PDF code | **Deploy PDF** | High until deploy | Code complete |
| Suppliers | CRUD + history | List + create | Edit/address | Med | Improved |
| Settings | Config + users | Read + admin create + VAT write | Invite email infra | Med | Improved |
| Login | Auth | Persistent sessions | Forgot password | Med | Operational |
