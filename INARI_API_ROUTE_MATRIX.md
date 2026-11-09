# API route matrix (production-server)

See `INARI_FULL_APPLICATION_AUDIT.md` for the complete frontend-linked matrix.

Key durable handlers:
- Reads → `ReadRepository`
- Purchases / closings / makeline / stock → `StockRepository`
- POS / kitchen status / void → `OrderRepository`
- Catalog creates → `CatalogRepository`
- Auth → `modules/auth/persistent-auth.ts` when `DATABASE_URL` set

Missing vs optional UI:
- `GET /purchases` — not registered (frontend tolerates empty history)
