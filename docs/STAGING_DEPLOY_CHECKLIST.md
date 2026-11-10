# Staging deploy checklist (Render + Netlify)

## 1. API (Render service `inarikicchin-api`)

Environment variables (already expected):
- `DATABASE_URL` — Supabase pooled URL
- `DIRECT_URL` — Supabase direct URL
- `INARI_TOKEN_SECRET` — ≥32 random chars
- `CORS_ORIGINS` — `https://inarikicchin.netlify.app,http://localhost:3001`
- `NODE_ENV=production`
- `PORT` — Render sets automatically

Build / start (from `apps/api` or monorepo root as currently configured):
```
npm install
npx prisma migrate deploy --schema prisma/schema.prisma
npm run start:prod
```

After deploy verify:
```
curl -s https://inarikicchin-api.onrender.com/health
curl -s https://inarikicchin-api.onrender.com/ready
```
Expect: `storage: postgresql`

New routes that must not 404:
- `GET /reports/sales.pdf`
- `POST /makeline`
- `GET /makeline/productions`
- `POST /menu/items`
- `POST /users`
- `PUT /settings/vat`
- `GET /stock/movements`
- `GET /purchases`

## 2. Frontend (Netlify)

Site env:
```
NEXT_PUBLIC_API_URL=https://inarikicchin-api.onrender.com
```

Build from monorepo / `apps/web` per existing `netlify.toml`.

## 3. Smoke tests (manager or admin)
1. Login
2. Dashboard loads (no ClosingStatus errors)
3. Menu → create item → edit price → toggle availability
4. Makeline → record production → history row appears
5. Suppliers → create
6. Inventory → Add line ×2 → Save receipt
7. POS → complete order → kitchen ticket
8. Kitchen → status transition
9. Closing → submit
10. Stock History → Movements tab
11. Reports → Apply → Export CSV → Export PDF
12. Settings (admin) → create user → update VAT

## 4. Only after smokes pass
Set `INARI_DURABLE_CONFIRMED=1` on Render and restart.

## Production
Do **not** deploy to production from this assignment.
