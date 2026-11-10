# Form field audit

## Inventory Received
| Field | Required | Type | Backend | Notes |
|-------|----------|------|---------|-------|
| productId | Y | select | purchase items.product_id | From /products |
| supplierId | Y | select | purchase.supplier_id | From /suppliers |
| quantity | Y | number | items.quantity | > 0 |
| totalPrice | Y | number | items.total_price | Unit price = total/qty |
| invoiceNumber | N | text | purchase.invoice_no | |
| dateReceived | Y | date | purchase.date_received | Default today |
| expiryDate | N | date | items.expiry_date | |
| notes | N | textarea | purchase.notes | |

## POS
| Field | Required | Backend |
|-------|----------|---------|
| orderType | Y | order.order_type from /meta |
| deliveryRef | if delivery | order.delivery_ref |
| lines[] | Y | order lines |
| paymentMethod | Y | payment_record.method_name |
| Idempotency-Key | Y | header |

## Closing Stock
| Field | Required | Backend |
|-------|----------|---------|
| items[].closingQty | Y | stock_closing_item.closing_qty |
| wastage where applicable | N | wastage_qty |

## Suppliers (create)
| Field | Required | Backend |
|-------|----------|---------|
| name | Y | supplier.name |
| contactPerson | N | contact_person |
| phone | N | phone |
| email | N | email validated client-side |

## Settings
Read-only from /meta — no write form fields active (by design until VAT effective-from is specified).
