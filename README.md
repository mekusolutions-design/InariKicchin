# Inari Kicchin — Next.js + TypeScript web + API

## Stack

| App | Tech |
|-----|------|
| **Web** | **Next.js 15 App Router + TypeScript + Tailwind** |
| **API** | TypeScript domain + production HTTP server (Phases 1–5) |
| **UI** | Blueprint §14 — navy sidebar, orange `#EA580C` primary |

## Local run

```bash
# Terminal 1 — API
cd apps/api
npm install
npm run start:prod
# → http://localhost:4040

# Terminal 2 — Web
cd apps/web
cp .env.example .env.local
npm install
npm run dev
# → http://localhost:3001
```

Login: `keya8020@gmail.com` / `keya2000`

## Deploy

### API → Render
- Root: `apps/api`
- Start: `npm run start:prod`
- Env: `INARI_TOKEN_SECRET`, `NODE_ENV=production`

### Web → Netlify or Render Static / Vercel
```bash
cd apps/web
# Build command
npm install && npm run build
# Publish / output: .next (Vercel/Render Node) or use `next start`
```

Set `NEXT_PUBLIC_API_URL=https://your-api.onrender.com`

### Vercel (recommended for Next)
- Root directory: `apps/web`
- Framework: Next.js
- Env: `NEXT_PUBLIC_API_URL`

## Routes (App Router)

`/login` · `/dashboard` · `/inventory-received` · `/makeline` · `/closing-stock` · `/stock-history` · `/menu` · `/pos` · `/kitchen-tickets` · `/reports` · `/suppliers` · `/settings`
