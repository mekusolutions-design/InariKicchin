# Inari Kicchin — Phase 5 Deployment & Operations

## What Phase 5 adds

| Item | Purpose |
|------|---------|
| Scrypt password hashing | No plaintext demo hashes in production path |
| Session tokens | Bearer auth on API |
| Permission matrix | Role checks on every protected route |
| `/health` + `/ready` | Load balancer / uptime probes |
| Prisma seed | Bootstrap admin + units + sample catalog |
| `.env.example` | Secrets template |
| Production server | `npm run start:prod` |

## Deploy checklist

### 1. Database

```bash
cd apps/api
cp ../../.env.example .env
# Edit DATABASE_URL and DIRECT_URL

npx prisma migrate deploy   # or: npx prisma db push
npx tsx prisma/seed.ts
```

### 2. API process

```bash
npm install
npm test
NODE_ENV=production INARI_TOKEN_SECRET=<long-random> npm run start:prod
```

### 3. Auth smoke test

```bash
curl -s -X POST http://localhost:4040/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"keya8020@gmail.com","password":"keya2000"}'

# Use accessToken:
curl -s http://localhost:4040/dashboard \
  -H "Authorization: Bearer <token>"
```

### 4. Web UI

Open `apps/web/public/index.html`. Log in with admin credentials.  
Token is stored in `localStorage.INARI_TOKEN`.

### 5. Backups

- Nightly logical dump: `pg_dump $DATABASE_URL > backup-$(date +%F).sql`
- Weekly restore test on a staging database
- Retain 30 days of backups off-host

### 6. Rollback

1. Redeploy previous API artifact  
2. Restore DB from last known good dump if a migration was applied  
3. Confirm `/health` and login  

## Security notes

- Change `INARI_TOKEN_SECRET` and all demo passwords before go-live  
- Force HTTPS at the reverse proxy (Caddy / Nginx / Cloudflare)  
- Do not expose `/auth/demo-users` in production (`NODE_ENV=production` hides it)  
- Rate-limit `/auth/login` at the proxy (app also locks after 5 failures / 15 min)  

## Owner acceptance (Phase 5)

- [ ] Admin can log in  
- [ ] Cashier cannot submit closing (403)  
- [ ] Manager can receive stock and close day  
- [ ] `/health` returns ok behind load balancer  
- [ ] Backup + restore drill recorded  
- [ ] Demo passwords rotated  
