
## Update 2026-11-10 (continued audit)

### Closed
- **POST /makeline** was missing from production-server — wired to `stockRepo.recordMakelineProduction`
- **GET /makeline/productions** production history
- **POST /menu/items** create menu item
- **POST /menu/items/:id/availability** toggle
- Menu UI create + availability
- Makeline UI history + on-hand display

### Still open
- Live deploy of PDF + new routes
- Email invitation / forgot-password
- Menu price edit with history UI (schema supports MenuItemPriceHistory)
- Multi-line purchase receipts in one form
- Running stock balances in movement ledger
