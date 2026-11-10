-- Enforce exactly one inventory target for polymorphic stock records.
-- This migration is additive and intentionally fails if existing rows are ambiguous.

ALTER TABLE "RecipeLine"
  ADD CONSTRAINT "RecipeLine_exactly_one_output_target_check"
    CHECK (("output_menu_item_id" IS NOT NULL) <> ("output_makeline_id" IS NOT NULL)),
  ADD CONSTRAINT "RecipeLine_exactly_one_input_target_check"
    CHECK (("input_product_id" IS NOT NULL) <> ("input_makeline_id" IS NOT NULL));

ALTER TABLE "StockAdjustment"
  ADD CONSTRAINT "StockAdjustment_exactly_one_target_check"
    CHECK (("product_id" IS NOT NULL) <> ("makeline_product_id" IS NOT NULL));

ALTER TABLE "WastageRecord"
  ADD CONSTRAINT "WastageRecord_exactly_one_target_check"
    CHECK (("product_id" IS NOT NULL) <> ("makeline_product_id" IS NOT NULL));

ALTER TABLE "StockClosingItem"
  ADD CONSTRAINT "StockClosingItem_target_matches_type_check"
    CHECK (
      ("item_type" = 'PRODUCT' AND "product_id" IS NOT NULL AND "makeline_product_id" IS NULL)
      OR
      ("item_type" = 'MAKELINE' AND "makeline_product_id" IS NOT NULL AND "product_id" IS NULL)
    );

ALTER TABLE "StockMovement"
  ADD CONSTRAINT "StockMovement_exactly_one_target_check"
    CHECK (("product_id" IS NOT NULL) <> ("makeline_product_id" IS NOT NULL));
