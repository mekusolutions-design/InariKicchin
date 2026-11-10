# Final release readiness

## Implemented & code-complete (UNVERIFIED on live staging until deploy)
1. Inventory/makeline typeahead + inline create  
2. Delivery vs in-house POS  
3. Settings modules/receipt/payment persistence  
4. POS Order Reports + day close  
5. Receipt print + DUPLICATE  
6. Manager PIN (set + void gate)  
7. Order type list/create/activate  
8. Admin user create  

## Recommendation
**Ready for staging acceptance testing after deploy.**  
**Not ready for production.**

### Required before production
1. Deploy API + web  
2. Admin sets manager PIN  
3. Smoke voids with/without PIN  
4. Smoke order-type delivery flag on POS  
5. Create cashier user and confirm Settings denied  
6. Day-close reconciliation against known orders  
7. Midnight boundary check (Africa/Nairobi)  
8. Client provides paybill/till for receipt box  
