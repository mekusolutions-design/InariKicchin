-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "RoleName" AS ENUM ('ADMINISTRATOR', 'MANAGER', 'CASHIER', 'KITCHEN_STAFF');

-- CreateEnum
CREATE TYPE "UnitDimension" AS ENUM ('WEIGHT', 'VOLUME', 'COUNT');

-- CreateEnum
CREATE TYPE "AdjustmentDirection" AS ENUM ('IN', 'OUT');

-- CreateEnum
CREATE TYPE "ClosingStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "ClosingItemType" AS ENUM ('PRODUCT', 'MAKELINE');

-- CreateEnum
CREATE TYPE "RestaurantOrderStatus" AS ENUM ('NEW', 'PREPARING', 'READY', 'SERVED', 'COLLECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RestaurantPaymentStatus" AS ENUM ('UNPAID', 'PARTIALLY_PAID', 'PAID', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PaymentRecordStatus" AS ENUM ('PENDING', 'CONFIRMED', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('PURCHASE_RECEIPT', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'WASTAGE', 'MAKELINE_PRODUCTION_IN', 'RECIPE_DEDUCTION', 'ORDER_VOID_REVERSAL', 'SUPPLIER_RETURN', 'OPENING_BALANCE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "password_hash" TEXT NOT NULL,
    "role" "RoleName" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT,
    "old_values" JSONB,
    "new_values" JSONB,
    "reason" TEXT,
    "ip_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updated_by" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "Unit" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dimension" "UnitDimension" NOT NULL,
    "factor_to_base" DECIMAL(18,8) NOT NULL,

    CONSTRAINT "Unit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ProductCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category_id" TEXT,
    "base_unit_id" TEXT NOT NULL,
    "min_stock_level" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "on_hand_qty" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "avg_unit_cost" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contact_person" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "kra_pin" TEXT,
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Purchase" (
    "id" TEXT NOT NULL,
    "purchase_no" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "invoice_no" TEXT,
    "date_received" TIMESTAMP(3) NOT NULL,
    "total_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Purchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseItem" (
    "id" TEXT NOT NULL,
    "purchase_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "quantity" DECIMAL(14,4) NOT NULL,
    "unit_id" TEXT NOT NULL,
    "quantity_base" DECIMAL(14,4) NOT NULL,
    "total_price" DECIMAL(14,2) NOT NULL,
    "unit_price" DECIMAL(14,4) NOT NULL,
    "expiry_date" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "PurchaseItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierReturn" (
    "id" TEXT NOT NULL,
    "purchase_item_id" TEXT NOT NULL,
    "quantity_base" DECIMAL(14,4) NOT NULL,
    "credit_amount" DECIMAL(14,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "returned_on" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierReturn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockAdjustment" (
    "id" TEXT NOT NULL,
    "product_id" TEXT,
    "makeline_product_id" TEXT,
    "direction" "AdjustmentDirection" NOT NULL,
    "quantity_base" DECIMAL(14,4) NOT NULL,
    "unit_cost" DECIMAL(14,4),
    "reason_code" TEXT,
    "reason_text" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'APPLIED',
    "created_by_id" TEXT,
    "approved_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WastageRecord" (
    "id" TEXT NOT NULL,
    "product_id" TEXT,
    "makeline_product_id" TEXT,
    "quantity_base" DECIMAL(14,4) NOT NULL,
    "unit_cost_at_time" DECIMAL(14,4),
    "reason_code" TEXT NOT NULL,
    "notes" TEXT,
    "wasted_on" TIMESTAMP(3) NOT NULL,
    "employee_id" TEXT,
    "recorded_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WastageRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MakelineProduct" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit_id" TEXT NOT NULL,
    "min_level" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "on_hand_qty" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "MakelineProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MakelineProduction" (
    "id" TEXT NOT NULL,
    "makeline_product_id" TEXT NOT NULL,
    "quantity" DECIMAL(14,4) NOT NULL,
    "produced_at" TIMESTAMP(3) NOT NULL,
    "produced_by_id" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MakelineProduction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockClosingSession" (
    "id" TEXT NOT NULL,
    "closing_no" TEXT NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "status" "ClosingStatus" NOT NULL DEFAULT 'DRAFT',
    "submitted_by_id" TEXT,
    "submitted_at" TIMESTAMP(3),
    "total_value_used" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total_value_wasted" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "supersedes_id" TEXT,
    "correction_reason" TEXT,
    "idempotency_key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockClosingSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockClosingItem" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "item_type" "ClosingItemType" NOT NULL,
    "product_id" TEXT,
    "makeline_product_id" TEXT,
    "name_snapshot" TEXT NOT NULL,
    "unit_snapshot" TEXT NOT NULL,
    "opening_qty" DECIMAL(14,4) NOT NULL,
    "received_qty" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "adj_in_qty" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "adj_out_qty" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "wastage_qty" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "available_qty" DECIMAL(14,4) NOT NULL,
    "closing_qty" DECIMAL(14,4) NOT NULL,
    "used_qty" DECIMAL(14,4) NOT NULL,
    "opening_value" DECIMAL(14,2),
    "received_value" DECIMAL(14,2),
    "avg_unit_cost" DECIMAL(14,4),
    "used_value" DECIMAL(14,2),
    "wastage_value" DECIMAL(14,2),
    "closing_value" DECIMAL(14,2),

    CONSTRAINT "StockClosingItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MenuCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "MenuCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MenuItem" (
    "id" TEXT NOT NULL,
    "item_code" TEXT,
    "name" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "price" DECIMAL(14,2) NOT NULL,
    "description" TEXT,
    "image_path" TEXT,
    "is_available" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "vat_class" TEXT NOT NULL DEFAULT 'STANDARD',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MenuItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MenuItemPriceHistory" (
    "id" TEXT NOT NULL,
    "menu_item_id" TEXT NOT NULL,
    "old_price" DECIMAL(14,2) NOT NULL,
    "new_price" DECIMAL(14,2) NOT NULL,
    "changed_by_id" TEXT,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT,

    CONSTRAINT "MenuItemPriceHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VatSetting" (
    "id" TEXT NOT NULL,
    "vat_enabled" BOOLEAN NOT NULL DEFAULT true,
    "rate_percent" DECIMAL(6,3) NOT NULL,
    "prices_include_vat" BOOLEAN NOT NULL DEFAULT true,
    "effective_from" TIMESTAMP(3) NOT NULL,
    "changed_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VatSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_delivery" BOOLEAN NOT NULL DEFAULT false,
    "requires_reference" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "OrderType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentMethod" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "requires_reference" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "PaymentMethod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeLine" (
    "id" TEXT NOT NULL,
    "output_menu_item_id" TEXT,
    "output_makeline_id" TEXT,
    "input_product_id" TEXT,
    "input_makeline_id" TEXT,
    "quantity" DECIMAL(14,4) NOT NULL,
    "unit_id" TEXT,

    CONSTRAINT "RecipeLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RestaurantOrder" (
    "id" TEXT NOT NULL,
    "order_no" TEXT NOT NULL,
    "order_type" TEXT NOT NULL,
    "status" "RestaurantOrderStatus" NOT NULL DEFAULT 'NEW',
    "payment_status" "RestaurantPaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "subtotal" DECIMAL(14,2) NOT NULL,
    "vat_total" DECIMAL(14,2) NOT NULL,
    "grand_total" DECIMAL(14,2) NOT NULL,
    "vat_mode" TEXT NOT NULL,
    "vat_rate" DECIMAL(6,3) NOT NULL,
    "cashier_id" TEXT NOT NULL,
    "table_no" TEXT,
    "delivery_ref" TEXT,
    "idempotency_key" TEXT NOT NULL,
    "void_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "voided_at" TIMESTAMP(3),

    CONSTRAINT "RestaurantOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RestaurantOrderLine" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "menu_item_id" TEXT,
    "name_snapshot" TEXT NOT NULL,
    "quantity" DECIMAL(14,4) NOT NULL,
    "unit_price" DECIMAL(14,2) NOT NULL,
    "line_total" DECIMAL(14,2) NOT NULL,
    "vat_amount" DECIMAL(14,2) NOT NULL,
    "vat_class" TEXT NOT NULL,
    "notes" TEXT,

    CONSTRAINT "RestaurantOrderLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentRecord" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "method_name" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "reference" TEXT,
    "status" "PaymentRecordStatus" NOT NULL DEFAULT 'CONFIRMED',
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmed_at" TIMESTAMP(3),
    "metadata" JSONB,

    CONSTRAINT "PaymentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KitchenTicket" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "ticket_no" TEXT NOT NULL,
    "status" "RestaurantOrderStatus" NOT NULL DEFAULT 'NEW',
    "print_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "preparing_at" TIMESTAMP(3),
    "ready_at" TIMESTAMP(3),
    "served_at" TIMESTAMP(3),

    CONSTRAINT "KitchenTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KitchenTicketTransition" (
    "id" TEXT NOT NULL,
    "ticket_id" TEXT NOT NULL,
    "from_status" "RestaurantOrderStatus",
    "to_status" "RestaurantOrderStatus" NOT NULL,
    "changed_by" TEXT,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KitchenTicketTransition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthSession" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3),
    "ip_address" TEXT,
    "user_agent" TEXT,

    CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdempotencyRecord" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "request_hash" TEXT NOT NULL,
    "response_status" INTEGER,
    "response_body" JSONB,
    "order_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3),

    CONSTRAINT "IdempotencyRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL,
    "movement_type" "StockMovementType" NOT NULL,
    "product_id" TEXT,
    "makeline_product_id" TEXT,
    "quantity_delta" DECIMAL(14,4) NOT NULL,
    "unit_cost" DECIMAL(14,4),
    "value_delta" DECIMAL(14,2),
    "source_type" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "actor_id" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthLoginAttempt" (
    "email" TEXT NOT NULL,
    "failed_count" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthLoginAttempt_pkey" PRIMARY KEY ("email")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "AuditLog_entity_type_entity_id_idx" ON "AuditLog"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "AuditLog_created_at_idx" ON "AuditLog"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "Unit_code_key" ON "Unit"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ProductCategory_name_key" ON "ProductCategory"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Product_name_key" ON "Product"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Purchase_purchase_no_key" ON "Purchase"("purchase_no");

-- CreateIndex
CREATE UNIQUE INDEX "MakelineProduct_name_key" ON "MakelineProduct"("name");

-- CreateIndex
CREATE UNIQUE INDEX "StockClosingSession_closing_no_key" ON "StockClosingSession"("closing_no");

-- CreateIndex
CREATE UNIQUE INDEX "StockClosingSession_idempotency_key_key" ON "StockClosingSession"("idempotency_key");

-- CreateIndex
CREATE INDEX "StockClosingItem_session_id_idx" ON "StockClosingItem"("session_id");

-- CreateIndex
CREATE UNIQUE INDEX "MenuCategory_name_key" ON "MenuCategory"("name");

-- CreateIndex
CREATE UNIQUE INDEX "MenuItem_item_code_key" ON "MenuItem"("item_code");

-- CreateIndex
CREATE UNIQUE INDEX "OrderType_name_key" ON "OrderType"("name");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentMethod_name_key" ON "PaymentMethod"("name");

-- CreateIndex
CREATE INDEX "RecipeLine_output_menu_item_id_idx" ON "RecipeLine"("output_menu_item_id");

-- CreateIndex
CREATE INDEX "RecipeLine_output_makeline_id_idx" ON "RecipeLine"("output_makeline_id");

-- CreateIndex
CREATE INDEX "RecipeLine_input_product_id_idx" ON "RecipeLine"("input_product_id");

-- CreateIndex
CREATE INDEX "RecipeLine_input_makeline_id_idx" ON "RecipeLine"("input_makeline_id");

-- CreateIndex
CREATE UNIQUE INDEX "RestaurantOrder_order_no_key" ON "RestaurantOrder"("order_no");

-- CreateIndex
CREATE UNIQUE INDEX "RestaurantOrder_idempotency_key_key" ON "RestaurantOrder"("idempotency_key");

-- CreateIndex
CREATE INDEX "RestaurantOrder_created_at_idx" ON "RestaurantOrder"("created_at");

-- CreateIndex
CREATE INDEX "RestaurantOrder_status_created_at_idx" ON "RestaurantOrder"("status", "created_at");

-- CreateIndex
CREATE INDEX "RestaurantOrder_payment_status_created_at_idx" ON "RestaurantOrder"("payment_status", "created_at");

-- CreateIndex
CREATE INDEX "RestaurantOrderLine_order_id_idx" ON "RestaurantOrderLine"("order_id");

-- CreateIndex
CREATE INDEX "RestaurantOrderLine_menu_item_id_idx" ON "RestaurantOrderLine"("menu_item_id");

-- CreateIndex
CREATE INDEX "PaymentRecord_order_id_recorded_at_idx" ON "PaymentRecord"("order_id", "recorded_at");

-- CreateIndex
CREATE INDEX "PaymentRecord_method_name_reference_idx" ON "PaymentRecord"("method_name", "reference");

-- CreateIndex
CREATE UNIQUE INDEX "KitchenTicket_ticket_no_key" ON "KitchenTicket"("ticket_no");

-- CreateIndex
CREATE INDEX "KitchenTicket_status_created_at_idx" ON "KitchenTicket"("status", "created_at");

-- CreateIndex
CREATE INDEX "KitchenTicket_order_id_idx" ON "KitchenTicket"("order_id");

-- CreateIndex
CREATE INDEX "KitchenTicketTransition_ticket_id_created_at_idx" ON "KitchenTicketTransition"("ticket_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "AuthSession_token_hash_key" ON "AuthSession"("token_hash");

-- CreateIndex
CREATE INDEX "AuthSession_user_id_expires_at_idx" ON "AuthSession"("user_id", "expires_at");

-- CreateIndex
CREATE INDEX "AuthSession_expires_at_revoked_at_idx" ON "AuthSession"("expires_at", "revoked_at");

-- CreateIndex
CREATE UNIQUE INDEX "IdempotencyRecord_order_id_key" ON "IdempotencyRecord"("order_id");

-- CreateIndex
CREATE INDEX "IdempotencyRecord_expires_at_idx" ON "IdempotencyRecord"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "IdempotencyRecord_scope_key_key" ON "IdempotencyRecord"("scope", "key");

-- CreateIndex
CREATE UNIQUE INDEX "StockMovement_idempotency_key_key" ON "StockMovement"("idempotency_key");

-- CreateIndex
CREATE INDEX "StockMovement_product_id_created_at_idx" ON "StockMovement"("product_id", "created_at");

-- CreateIndex
CREATE INDEX "StockMovement_makeline_product_id_created_at_idx" ON "StockMovement"("makeline_product_id", "created_at");

-- CreateIndex
CREATE INDEX "StockMovement_source_type_source_id_idx" ON "StockMovement"("source_type", "source_id");

-- CreateIndex
CREATE INDEX "AuthLoginAttempt_locked_until_idx" ON "AuthLoginAttempt"("locked_until");

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "ProductCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_base_unit_id_fkey" FOREIGN KEY ("base_unit_id") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseItem" ADD CONSTRAINT "PurchaseItem_purchase_id_fkey" FOREIGN KEY ("purchase_id") REFERENCES "Purchase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseItem" ADD CONSTRAINT "PurchaseItem_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseItem" ADD CONSTRAINT "PurchaseItem_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierReturn" ADD CONSTRAINT "SupplierReturn_purchase_item_id_fkey" FOREIGN KEY ("purchase_item_id") REFERENCES "PurchaseItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockAdjustment" ADD CONSTRAINT "StockAdjustment_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockAdjustment" ADD CONSTRAINT "StockAdjustment_makeline_product_id_fkey" FOREIGN KEY ("makeline_product_id") REFERENCES "MakelineProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockAdjustment" ADD CONSTRAINT "StockAdjustment_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockAdjustment" ADD CONSTRAINT "StockAdjustment_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WastageRecord" ADD CONSTRAINT "WastageRecord_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WastageRecord" ADD CONSTRAINT "WastageRecord_makeline_product_id_fkey" FOREIGN KEY ("makeline_product_id") REFERENCES "MakelineProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WastageRecord" ADD CONSTRAINT "WastageRecord_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MakelineProduct" ADD CONSTRAINT "MakelineProduct_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MakelineProduction" ADD CONSTRAINT "MakelineProduction_makeline_product_id_fkey" FOREIGN KEY ("makeline_product_id") REFERENCES "MakelineProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MakelineProduction" ADD CONSTRAINT "MakelineProduction_produced_by_id_fkey" FOREIGN KEY ("produced_by_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockClosingSession" ADD CONSTRAINT "StockClosingSession_submitted_by_id_fkey" FOREIGN KEY ("submitted_by_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockClosingSession" ADD CONSTRAINT "StockClosingSession_supersedes_id_fkey" FOREIGN KEY ("supersedes_id") REFERENCES "StockClosingSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockClosingItem" ADD CONSTRAINT "StockClosingItem_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "StockClosingSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockClosingItem" ADD CONSTRAINT "StockClosingItem_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockClosingItem" ADD CONSTRAINT "StockClosingItem_makeline_product_id_fkey" FOREIGN KEY ("makeline_product_id") REFERENCES "MakelineProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "MenuCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuItemPriceHistory" ADD CONSTRAINT "MenuItemPriceHistory_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "MenuItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuItemPriceHistory" ADD CONSTRAINT "MenuItemPriceHistory_changed_by_id_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeLine" ADD CONSTRAINT "RecipeLine_output_menu_item_id_fkey" FOREIGN KEY ("output_menu_item_id") REFERENCES "MenuItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeLine" ADD CONSTRAINT "RecipeLine_output_makeline_id_fkey" FOREIGN KEY ("output_makeline_id") REFERENCES "MakelineProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeLine" ADD CONSTRAINT "RecipeLine_input_product_id_fkey" FOREIGN KEY ("input_product_id") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeLine" ADD CONSTRAINT "RecipeLine_input_makeline_id_fkey" FOREIGN KEY ("input_makeline_id") REFERENCES "MakelineProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeLine" ADD CONSTRAINT "RecipeLine_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestaurantOrder" ADD CONSTRAINT "RestaurantOrder_cashier_id_fkey" FOREIGN KEY ("cashier_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestaurantOrderLine" ADD CONSTRAINT "RestaurantOrderLine_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "RestaurantOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestaurantOrderLine" ADD CONSTRAINT "RestaurantOrderLine_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "MenuItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRecord" ADD CONSTRAINT "PaymentRecord_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "RestaurantOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KitchenTicket" ADD CONSTRAINT "KitchenTicket_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "RestaurantOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KitchenTicketTransition" ADD CONSTRAINT "KitchenTicketTransition_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "KitchenTicket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KitchenTicketTransition" ADD CONSTRAINT "KitchenTicketTransition_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdempotencyRecord" ADD CONSTRAINT "IdempotencyRecord_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "RestaurantOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_makeline_product_id_fkey" FOREIGN KEY ("makeline_product_id") REFERENCES "MakelineProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
