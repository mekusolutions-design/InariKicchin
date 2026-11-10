# Outstanding gaps & client decisions

## Client decisions needed
| Topic | Impact |
|-------|--------|
| Paybill business number / till | Receipt payment box |
| Bank details | Receipt |
| Platform commission % | Needs schema column + UI if required |
| Printer model / 58 vs 80 mm | Physical validation |
| Stock clerk role | Schema enum change |

## Technical gaps
- Module switches not fully enforced on every backend branch  
- Recipe makeline deductions deferred  
- Manager PIN is org-wide SystemSetting (not per-manager)  
- Excel export not implemented (CSV/PDF where present)  
