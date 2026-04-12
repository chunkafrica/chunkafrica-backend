DO $$
BEGIN
  ALTER TYPE "InventoryItemType" ADD VALUE 'INTERMEDIATE';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "ProductionDefinitionType" AS ENUM ('RECIPE', 'BOM_SPEC');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Recipe"
ADD COLUMN "name" TEXT,
ADD COLUMN "definitionType" "ProductionDefinitionType" NOT NULL DEFAULT 'RECIPE';

ALTER TABLE "Recipe"
ALTER COLUMN "menuItemId" DROP NOT NULL;

UPDATE "Recipe" AS r
SET "name" = COALESCE(
  (
    SELECT mi."name"
    FROM "MenuItem" AS mi
    WHERE mi."id" = r."menuItemId"
  ),
  ii."name",
  'Production definition'
)
FROM "InventoryItem" AS ii
WHERE ii."id" = r."producedInventoryItemId"
  AND r."name" IS NULL;

ALTER TABLE "Recipe"
ALTER COLUMN "name" SET NOT NULL;

DROP INDEX IF EXISTS "Recipe_menuItemId_version_key";
CREATE UNIQUE INDEX "Recipe_producedInventoryItemId_version_key" ON "Recipe"("producedInventoryItemId", "version");

ALTER TABLE "ProductionBatch"
ALTER COLUMN "menuItemId" DROP NOT NULL;

ALTER TABLE "ProductionBatch"
ADD COLUMN "outputVarianceQuantity" DECIMAL(18,4) NOT NULL DEFAULT 0;

UPDATE "ProductionBatch"
SET "outputVarianceQuantity" =
  CASE
    WHEN "plannedOutputQuantity" IS NULL THEN 0
    ELSE "actualOutputQuantity" - "plannedOutputQuantity"
  END;
