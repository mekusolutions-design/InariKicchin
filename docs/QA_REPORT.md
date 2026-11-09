# QA Report — Inari Kicchin (post master prompt application)

**Date:** 2026-11-09  
**Prompt applied:** `docs/MASTER_QA_PROMPT.md`  
**Spec:** Restaurant Management System Blueprint v1.0  

---

## 1. Test execution

| Suite | Result |
|-------|--------|
| Stock calculations C1–C4, B1, makeline | **PASS** |
| Units C6–C7 | **PASS** |
| VAT C8–C9 | **PASS** |
| Store Phase 1–3 workflows | **PASS** |
| Phase 4 (recipes, offline, eTIMS payload, M-Pesa stub, CSV) | **PASS** |
| Auth + permissions | **PASS** |
| **Total** | **42 / 42 pass** |

Command used:

```bash
node --experimental-strip-types --test src/domain/**/*.node-test.ts
```

Domain formulas were **not** modified.

---

## 2. Findings (severity order)

### Fixed

| Sev | Finding | Decision | Fix |
|-----|---------|----------|-----|
| High | `vat/calculations.ts` imported `../stock/calculations` without `.ts` — broke ESM/test runner | Fix import; do not change VAT math | Added `.ts` extension |
| Medium | `user.lastLoginAt` assigned with unsafe cast; field missing on `User` | Add optional field; set ISO string | `store.ts` + `auth.ts` |
| Medium | Login `Button type="submit"` fragile vs hardcoded `type="button"` order | Default `type = "button"` via props | `Button.tsx` |
| Medium | Stock History reused Closing page (wrong title/intent) | Separate history view, same read API | `stock-history/page.tsx` |
| Low | `GET /menu` authenticated but no role permission | Require `menu:read` (cashier has it for POS) | `production-server.ts` |

### Accepted gaps (not fixed — by design / phase)

| Sev | Gap | Rationale |
|-----|-----|-----------|
| Medium | Closing Stock UI lists sessions only; no full count grid from §14.5 | Would be large UI work; **server** `submitClosing` + B1 rules remain correct. Documented residual. |
| Medium | No Excel/PDF binary export | CSV sales export exists (Phase 4); full PDF is report enhancement |
| Low | Dashboard charts / sales-by-hour | Not required for formula correctness; KPI cards present |
| Low | In-memory store vs Prisma in production path | Schema + seed ready; domain proven; Nest/Prisma wiring is deploy hardening |
| Info | Free Render cold start | Ops note, not code defect |

---

## 3. Security review (executed logic)

| Check | Result |
|-------|--------|
| Unauthenticated `/dashboard` | 401 (production server) |
| Cashier `POST /closings` | 403 |
| Login lockout after repeated failures | Implemented in `auth.ts` |
| Scrypt password hashing | Implemented; demo seeds upgraded on boot |
| `NODE_ENV=production` hides `/auth/demo-users` | Yes |

---

## 4. Frontend review

| Check | Result |
|-------|--------|
| Next.js App Router + TypeScript | Yes — prior production build 16 routes OK |
| Blueprint colours (navy / `#EA580C`) | Yes — Tailwind tokens |
| Auth gate on `(app)/layout` | Redirect to `/login` if no token |
| API client clears session on 401 | Yes |
| POS + kitchen happy path (code path) | Wired to production API contracts |

---

## 5. Tough decisions log

1. **Do not rewrite closing UI grid in this pass** — protects schedule; backend already enforces blueprint rules.  
2. **Do not weaken tests** to hide import/ESM issues — fixed the import.  
3. **Tighten menu read permission** rather than leave auth-only — cashiers still allowed via matrix.  
4. **Keep in-memory demo engine** for CI without Postgres — Prisma remains the production schema target.

---

## 6. Residual risk for go-live

1. Change `INARI_TOKEN_SECRET` and all demo passwords.  
2. Provision Postgres + migrate/seed before treating data as durable.  
3. Complete Closing Stock interactive grid before manager UAT of §18 Phase 1 checklist.  
4. Point `NEXT_PUBLIC_API_URL` at the real Render API for the Next deploy.

---

## 7. Conclusion

Master QA prompt **applied**. Domain logic **intact**. **42 tests green**. Critical auth/permission and ESM defects **fixed**. Remaining items are documented product gaps, not silent formula failures.

---

## 7. Follow-up production-readiness assessment (9 November 2026)

The report above documents domain QA, not full production readiness. A subsequent release assessment identified that `production-server.ts` still uses the in-memory demo store and is not wired to Prisma. The prior report's accepted-gap wording must not be interpreted as approval for live operations.

See `PRODUCTION_READINESS_REPORT.md` for the current decision and evidence. The API now has a fail-closed production startup guard; `/ready` returns 503 while persistence is non-durable. The 42 domain tests were rerun and passed, but database integration, full frontend build and live deployment remain unverified.
