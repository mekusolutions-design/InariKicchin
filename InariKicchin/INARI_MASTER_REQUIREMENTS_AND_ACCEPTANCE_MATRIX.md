# Master requirements & acceptance matrix

Sources: Developer Brief (10 Nov 2026), Renovated Screens (10 screens), codebase ZIP `InariKicchin-main (4)`.

| ID | Source | Requirement | Status | Notes |
|----|--------|-------------|--------|-------|
| INV-01 | Brief §2 | Product typeahead combobox | Implemented | `TypeaheadCombobox` + Inventory page |
| INV-02 | Brief §2 | Supplier typeahead | Implemented | Same component |
| INV-03 | Brief §2 | Inline product create | Implemented | POST /products |
| INV-04 | Brief §2 | Inline supplier create | Implemented | POST /suppliers |
| INV-05 | Brief §2 | Last supplier per product | Implemented | localStorage map |
| INV-06 | Brief §2 | Unit price auto | Implemented | total/qty |
| INV-07 | Brief §2 | Locked receipts | Domain | Corrections via adjustments |
| MK-01 | Brief §3 | Makeline typeahead | Implemented | |
| MK-02 | Brief §3 | Inline makeline product | Implemented | POST /makeline/products |
| MK-03 | Brief §3 | POST production | Implemented | POST /makeline |
| MK-04 | Brief §3 | Separate from purchase stock | Domain | |
| MENU-01 | Brief §4 | Create/edit/availability | Partial | Create/price/avail in prior work; this ZIP needs menu routes if missing |
| POS-01 | Brief §5 | Order types from settings | Partial | /meta orderTypes |
| POS-02 | Brief §5.3 | Delivery hides cash methods | Implemented | |
| POS-03 | Brief §5.3 | Platform order code required | Implemented | |
| POS-04 | Brief §5.3 | Unsettled platform payment label | Implemented | |
| POS-05 | Brief §5.1 | Printable receipt | Missing | Needs receipt snapshot + print view |
| SET-01 | Brief §6 | Module switches | Missing | SystemSetting keys |
| SET-02 | Brief §6 | VAT write | Partial | prior API; verify on this ZIP |
| SET-03 | Brief §6 | Users CRUD | Partial | prior API |
| REP-01 | Brief §7 | POS Order Reports page | Missing | Dedicated screen |
| REP-02 | Brief §7 | Day close | Missing | |
| SEC-01 | Brief §6.4 | Cashiers no Settings | Partial | frontend + assertPermission |

## Client decisions still needed
- Paybill / till numbers
- Printer model & paper width
- Commission % per platform
- Whether recipe deductions are phase-1

## Release
**Staging candidate after deploy of this ZIP** — not production-ready until receipts, POS reports, and settings module switches land.

## Update — continued implementation
| ID | Status |
|----|--------|
| POS-05 Receipt print | Implemented — `/receipts/[id]` + browser print, DUPLICATE marker, settings-driven header/paybill |
| SET-01 Module switches | Implemented — GET/PUT `/settings` + Settings UI |
| SET receipt/payment | Implemented — SystemSetting keys |
| REP-01 POS Order Reports | Implemented — page + `/reports/pos-orders` + day close |
| MENU archive | Implemented — POST `/menu/items/:id/archive` |
| Cashiers block Settings | Implemented — UI gate by role |

Still open: physical printer validation, manager PIN voids, order-type CRUD UI, concurrent receipt stress test on staging.
