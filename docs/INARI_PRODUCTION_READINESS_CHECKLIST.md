# Production Readiness Checklist

| Criterion | Status |
|----------|--------|
| Database migrations on staging | PASS (Supabase) |
| Bootstrap admin seed | PASS |
| Persistent authentication | PASS (integration tested) |
| Business routes PostgreSQL-backed when DATABASE_URL set | PASS (matrix) |
| No silent in-memory in production with gate | PASS (gate requires INARI_DURABLE_CONFIRMED) |
| Sales CSV / supplier analytics / eTIMS durable | PASS |
| Product/supplier create endpoints | PASS |
| Financial/WAC/VAT domain helpers preserved | PASS |
| Integration tests on Supabase | PASS (4/4) |
| Unit/schema tests | PASS (53/53) |
| Concurrent multi-process tests | NOT RUN |
| Render staging redeploy + /ready smoke | NOT RUN this session |
| Netlify frontend E2E against staging API | NOT RUN this session |
| Offline queue full durable workflow | PARTIAL (IdempotencyRecord) |
| eTIMS KRA submission | N/A (prep only) |
| INARI_DURABLE_CONFIRMED set | **NO — intentional** |

## Recommendation

**CONDITIONAL GO for staging API redeploy and frontend smoke.**

**NO-GO for production** until:
1. Render service is redeployed with DATABASE_URL/DIRECT_URL/INARI_TOKEN_SECRET/CORS_ORIGINS.
2. `GET /ready` returns ready against Supabase.
3. Staging login → purchase → POS → closing → CSV smoke passes on the deployed URL.
4. Operator sets `INARI_DURABLE_CONFIRMED=1` only after that evidence.
