# Inari Kicchin — Screen-by-screen gap fixes (10 Nov 2026)

Aligned to *Renovated System Screens* and *POS Developer Brief*.

## 1. Inventory Received
**Status:** Largely complete before this pass  
- Typeahead product + supplier with inline create  
- Last-used supplier preference (localStorage)  
- Auto unit price, history panel, non-editable saved receipts  

**Gaps remaining:** near-duplicate name warning is soft only; expiry optional field present.

## 2. Makeline Inventory
**Status:** Complete for v1  
- Typeahead + inline create  
- Stock table separate from purchased  
- Empty state prompts create  

**Deferred:** optional recipe deduction UI (settings flag exists; domain Phase 4 hooks exist).

## 3–4. Menu Management
**Fixed this pass**  
- Create / edit form with name, code, category, price, description, availability  
- Archive / restore / sold-out  
- API: `POST /menu/items`, `PUT /menu/items/:id`, archive endpoint  
- List returns `category`, `code`, `isActive`  

## 5–7. POS + receipt
**Fixed this pass**  
- Separate **table number** vs **platform order code**  
- Delivery hides in-house payment methods; requires platform code  
- VAT rate / inclusive / enabled driven by Settings + `/meta`  
- Sold-out badge on unavailable items  
- Cash tendered + change  
- Post-complete: receipt link + New order  
- Receipt: business header, table, platform code, cashier, net/VAT, paybill box with account (ORDER/TABLE), DUPLICATE marker, 58/80mm class  

## 8–9. Settings
**Fixed this pass**  
- Modules save uses single DB transaction (faster, atomic)  
- **VAT tab** now editable (enabled, rate %, inclusive) and persists via system settings  
- Receipt / payment / users / order types already present  

**Remaining:** module switches partially enforced on POS (table, print); full feature gating for kitchen tickets / discounts still needs order-create path checks.

## 10. POS Order Reports
**Improved this pass**  
- Day close, by payment / type, Nairobi dates already present  
- **Reprint** link per order → `/receipts/:id`  

## Kitchen Tickets
**Fixed earlier in this stabilisation**  
- No SERVED→SERVED loop  
- Final tickets leave active board  
- Served vs Collected by order type  
- Backend idempotent final states  

## Still partial / not fully verified live
| Area | Notes |
|------|--------|
| Closing stock | UI exists; needs live Postgres smoke |
| Dashboard low-stock | Depends on module flag + product min levels |
| CSV / PDF export buttons | API has CSV path; UI export buttons may be incomplete on some report pages |
| Physical thermal print | Browser print only |
| eTIMS / live M-Pesa | Payload stubs only |
| Manager PIN void flow | API supports; UI path needs role testing |

## Deploy checklist
1. Deploy API with these repository + route changes  
2. Deploy web with POS, menu, kitchen, settings, receipts, reports pages  
3. Smoke: login → settings VAT → create menu item → POS dine-in + Glovo → kitchen flow → reprint from reports  


## Additional pass (continued)

### Closing stock
- Loads purchased **and** makeline balances
- Submit payload uses `itemType` PRODUCT/MAKELINE, periodStart/End (Africa/Nairobi), idempotency key
- Server defaults period dates and normalises itemType
- Recent closings list + used-value estimate

### Suppliers
- **+ New supplier** form (name, phone, KRA, notes)
- Empty state with create CTA

### Dashboard
- Removed invented hourly / order-type chart placeholders (only real API series)

### POS modules
- **Discount** field when `module_discounts=1`
- Order create respects `module_kitchen_tickets` (no ticket if off)
- Order create uses Settings VAT (enabled/rate/inclusive)
- Discounts rejected server-side when module off

### POS Order Reports
- Export CSV button (sales.csv endpoint)

### API product shapes
- `products()` includes `kind: purchased`
- `makelineProducts()` includes `kind: makeline` and `baseUnit`

## Pass 3 — wastage, modules, history detail

### Wastage
- `POST /wastage` on production API (durable + in-memory)
- UI on Closing Stock: product select, qty, required reason
- Supports purchased and makeline products

### POS order types
- Only **active** order types from `/meta`
- If `module_dine_pickup_delivery` is off, only Dine In / Pick Up tabs

### Dashboard
- Low-stock panel respects `module_low_stock_alerts`
- No invented chart series

### Stock history
- Renders closing **line items** (open/recv/waste/close/used/value) when API returns them

### Still deferred
- Makeline recipe deduction UI
- Live eTIMS / M-Pesa gateways
- Thermal printer drivers
- Excel/PDF export buttons on stock history (still disabled placeholders)

## Pass 4 — roles, void, exports

### Role-based navigation
- Sidebar filtered by role (Cashier → POS + order reports; Kitchen → tickets + makeline; Admin/Manager → full)
- Login redirects: Cashier → `/pos`, Kitchen → `/kitchen-tickets`, else dashboard

### Order void
- POS Order Reports: **Void** action with reason + manager PIN (admin skips PIN)
- Calls `POST /orders/:id/void`

### Exports / dates
- Sales reports default date uses Africa/Nairobi
- Stock history: Export CSV from closing line items + Print/PDF via browser

### Still external / deferred
- Recipe deduction UI, eTIMS, live M-Pesa, dedicated thermal drivers

## Pass 5 — categories & makeline recipes

### Menu categories
- API: `GET/POST /menu/categories`, `PUT /menu/categories/:id`
- Menu page: **Manage categories** panel (list + create)

### Makeline recipes
- API: `GET/POST /recipes`, `DELETE /recipes/:id`
- `recordMakelineProduction` deducts purchased inputs when Settings `module_makeline_deductions=1`
- Makeline UI: recipe lines editor, batch preview, post-save deduction summary
- CORS allows DELETE

### Remaining external-only
- Live eTIMS / M-Pesa gateways
- Dedicated thermal printer drivers
