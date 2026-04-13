ALTER TABLE "MenuItem"
ADD COLUMN "inventoryItemId" UUID;

WITH recipe_backfill AS (
  SELECT
    recipe."menuItemId",
    (ARRAY_AGG(recipe."producedInventoryItemId" ORDER BY recipe."producedInventoryItemId"))[1] AS "inventoryItemId"
  FROM "Recipe" AS recipe
  INNER JOIN "InventoryItem" AS inventory_item
    ON inventory_item."id" = recipe."producedInventoryItemId"
  WHERE recipe."deletedAt" IS NULL
    AND inventory_item."deletedAt" IS NULL
    AND inventory_item."isActive" = TRUE
    AND inventory_item."itemType" = 'FINISHED_GOOD'
  GROUP BY recipe."menuItemId"
  HAVING COUNT(DISTINCT recipe."producedInventoryItemId") = 1
)
UPDATE "MenuItem" AS menu_item
SET "inventoryItemId" = recipe_backfill."inventoryItemId"
FROM recipe_backfill
WHERE menu_item."id" = recipe_backfill."menuItemId"
  AND menu_item."inventoryItemId" IS NULL;

WITH name_match_candidates AS (
  SELECT
    LOWER(BTRIM(inventory_item."name")) AS "normalizedName",
    (ARRAY_AGG(inventory_item."id" ORDER BY inventory_item."id"))[1] AS "inventoryItemId"
  FROM "InventoryItem" AS inventory_item
  WHERE inventory_item."deletedAt" IS NULL
    AND inventory_item."isActive" = TRUE
    AND inventory_item."itemType" = 'FINISHED_GOOD'
  GROUP BY LOWER(BTRIM(inventory_item."name"))
  HAVING COUNT(*) = 1
)
UPDATE "MenuItem" AS menu_item
SET "inventoryItemId" = name_match_candidates."inventoryItemId"
FROM name_match_candidates
WHERE menu_item."inventoryItemId" IS NULL
  AND LOWER(BTRIM(menu_item."name")) = name_match_candidates."normalizedName";

DO $$
DECLARE
  unresolved_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO unresolved_count
  FROM "MenuItem"
  WHERE "inventoryItemId" IS NULL;

  IF unresolved_count > 0 THEN
    RAISE EXCEPTION
      'Wave 1 migration blocked: % menu items still need an inventory linkage before hardening the constraint.',
      unresolved_count;
  END IF;
END $$;

ALTER TABLE "MenuItem"
ALTER COLUMN "inventoryItemId" SET NOT NULL;

ALTER TABLE "MenuItem"
ADD CONSTRAINT "MenuItem_inventoryItemId_fkey"
FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

CREATE UNIQUE INDEX "MenuItem_inventoryItemId_key" ON "MenuItem"("inventoryItemId");
CREATE INDEX "MenuItem_businessId_inventoryItemId_idx" ON "MenuItem"("businessId", "inventoryItemId");
