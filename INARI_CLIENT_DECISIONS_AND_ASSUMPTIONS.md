# Client decisions & assumptions

| Topic | Assumption until confirmed |
|-------|----------------------------|
| Account creation | Admin-created only (no public signup) |
| Delivery payment | Recorded as `Platform - {name} (unsettled)` |
| VAT default | 16% inclusive when no VatSetting row |
| Makeline cost | Quantity-only (no KSh valuation) |
| Receipts | Print deferred until paybill + paper width confirmed |
| Recipe deductions | Deferred (schema supports; not wired in production) |
