# InariKicchin — UI Implementation Report

## Design system changes
- Extended `globals.css` with:
  - `.page-title`, `.page-sub`, `.field-label`, `.field-input`, `.field-readonly`
  - `.kpi-card`, `.kpi-value`, `.kpi-hint`
  - `.table-base`, `.num`
  - Simple `.bar-chart` CSS for dashboard hourly sales
- Tailwind tokens already matched blueprint (§14.1): navy, primary `#EA580C`, success/warning/danger/purple/info.

## Components updated
- `apps/web/src/components/layout/Sidebar.tsx` — retained (already blueprint-aligned).
- `apps/web/src/components/layout/Topbar.tsx` — retained.
- `apps/web/src/components/ui/Button.tsx` — retained (min touch height, variants).
- `apps/web/src/components/ui/Badge.tsx` — retained.
- `apps/web/src/app/(app)/layout.tsx` — desktop grid + mobile drawer navigation.

## Pages substantially refined
| Page | Path | Key changes |
|------|------|-------------|
| Dashboard | `dashboard/page.tsx` | 6 KPIs, bar chart, order-type bars, quick actions, low-stock, best-sellers |
| Inventory Received | `inventory-received/page.tsx` | Two-column form, live unit price, history table |
| Makeline | `makeline/page.tsx` | Production form, purple language, stock table |
| Closing Stock | `closing-stock/page.tsx` | Section A/B, editable closing counts, used/value, submit |
| POS | `pos/page.tsx` | Order-type chips, category filters, product tiles, cart + VAT + payment |

## Pages lightly polished via shared styles
- Stock History, Menu, Kitchen Tickets, Reports, Suppliers, Settings, Login.

## Responsive
- Desktop: sidebar + topbar + content (unchanged structure).
- Mobile (`md` breakpoint): hamburger drawer, stacked content, bottom padding for safe area.

## Files changed (frontend only)
- `apps/web/src/app/globals.css`
- `apps/web/src/app/(app)/layout.tsx`
- `apps/web/src/app/(app)/dashboard/page.tsx`
- `apps/web/src/app/(app)/inventory-received/page.tsx`
- `apps/web/src/app/(app)/makeline/page.tsx`
- `apps/web/src/app/(app)/closing-stock/page.tsx`
- `apps/web/src/app/(app)/pos/page.tsx`

**No API, Prisma, migration, domain calculation, auth, or database files were modified.**

## Accessibility & interaction
- Minimum 44px touch targets on buttons and POS tiles.
- Focus rings on form fields via Tailwind focus utilities.
- Disabled states on submit while requests are in flight.
- Clear success / error feedback near primary actions.

## Update — remaining screens (this pass)

Completed blueprint-aligned layouts for the previously thin pages:

| Page | Changes |
|------|---------|
| Stock History | Left list of past closings + detail KPIs, purple treatment, export buttons (disabled until API export exists) |
| Menu Management | Category chips, search, code/category/price/status table, inactive opacity |
| Kitchen Tickets | Kanban columns with clearer ticket cards, auto-refresh, busy state on status buttons |
| Reports | Date range filter, 4 sales KPIs + stock used / wastage panels, Phase 4 profit note |
| Settings | Tabbed UI (Users, VAT, Payments, Order types, Security) |
| Suppliers | Search, contact/phone columns, status badges |
| Shell | Mobile drawer closes on navigate; improved touch target on hamburger |

All pages now use shared `page-title` / `page-sub` / `field-*` / `table-base` / `kpi-*` classes.
