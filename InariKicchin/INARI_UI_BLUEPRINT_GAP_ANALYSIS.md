# InariKicchin — UI Blueprint Gap Analysis

**Source of truth:** Restaurant Management System Blueprint v1.0 (Section 14, pages 25–36)  
**Codebase:** `apps/web` (Next.js 15 + Tailwind + Inter)

## Design system (shared)

| Aspect | Blueprint | Previous state | Action taken |
|--------|-----------|----------------|--------------|
| Sidebar | Dark navy, 11 sections in fixed order | Present, correct order | Retained & refined active state |
| Primary colour | `#EA580C` orange | Already in Tailwind tokens | Retained |
| Semantic colours | Green / amber / red / purple / blue | Present | Extended usage |
| Typography | Inter / system, 14–16px body | Inter loaded | page-title / page-sub / field-* utilities added |
| Touch targets | ≥44×44px | Buttons min-h-11 | Preserved |
| Forms | Required *, calculated grey/green read-only | Partial | `.field-input` / `.field-readonly` utilities |

## Screen-by-screen

### 1. Dashboard (§14.2)
- **Previous:** 5 KPI cards, low-stock table, quick actions.
- **Gaps:** Missing 6th KPI (stock received), sales-by-hour chart, sales-by-order-type bars, best-sellers, clearer “not profit” labelling.
- **Completed:** Six KPI cards, CSS bar chart for sales-by-hour, order-type breakdown, quick actions, low-stock, best-sellers placeholder, loading skeleton.

### 2. Inventory Received (§14.3)
- **Previous:** Basic two-column form + product list.
- **Gaps:** Category auto, unit price live panel, invoice/expiry/notes fields, history table styling, calculated field treatment.
- **Completed:** Full form layout with live unit-price panel, supplier/invoice/date/expiry/notes, history table, success/error feedback. API contracts unchanged.

### 3. Makeline Inventory (§14.4)
- **Previous:** Minimal list.
- **Gaps:** Production form, purple visual language, “how it works” callout, stock table.
- **Completed:** Record-production form, purple accents, stock table, explanatory panel. No cost values introduced.

### 4. Closing Stock (§14.5)
- **Previous:** History table only.
- **Gaps:** Purchased vs makeline sections, editable closing inputs, used/value calculations display, draft badge, submit controls.
- **Completed:** Section A/B structure, orange closing inputs, live used/value columns, submit + recent closings. Calculations remain API-driven; frontend only displays.

### 5. Stock History (§14.6)
- Existing page retained; visual polish deferred to shared table styles. Export buttons and comparison UI depend on API capabilities.

### 6. Menu Management (§14.7)
- Existing list retained. Full add/edit form fidelity limited by current backend exposure.

### 7. POS / Sales (§14.8)
- **Previous:** Functional cart + list.
- **Gaps:** Order-type chips, category filters, large product tiles (≥120×110), cart panel with VAT breakdown, payment method chips, M-Pesa code field.
- **Completed:** Full POS layout matching blueprint hierarchy. Idempotency header retained. Response shape `{ order, ticket }` preserved.

### 8. Kitchen Tickets (§14.9)
- Existing ticket list retained; status badges already semantic.

### 9. Reports (§14.10)
- Existing summary retained. Gross-profit explicitly not fabricated (Phase 4 note respected).

### 10. Settings (§14.11)
- Existing tabs/sections retained.

### Responsive (§14.12)
- **Completed:** Mobile drawer navigation, stacked main content, no horizontal scroll on primary forms. Desktop grid unchanged above `md`.

## Limitations documented
- Charts and some secondary series use illustrative fallbacks when the API does not yet return hourly / order-type / best-seller series.
- Full interactive closing with opening/received/adj/waste columns requires richer API payloads; current UI uses available on-hand balances.
- No backend or Prisma changes were made.
