-- AlterTable
ALTER TABLE "ProductionBatch" ADD COLUMN     "actualTotalCost" DECIMAL(18,4) NOT NULL DEFAULT 0,
ADD COLUMN     "actualUnitCost" DECIMAL(18,4) NOT NULL DEFAULT 0,
ADD COLUMN     "expectedTotalCost" DECIMAL(18,4) NOT NULL DEFAULT 0,
ADD COLUMN     "expectedUnitCost" DECIMAL(18,4) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "ProductionBatchIngredient" ADD COLUMN     "actualCost" DECIMAL(18,4) NOT NULL DEFAULT 0,
ADD COLUMN     "expectedCost" DECIMAL(18,4) NOT NULL DEFAULT 0,
ADD COLUMN     "unitCostSnapshot" DECIMAL(18,4) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "StockMovement" ADD COLUMN     "totalCostSnapshot" DECIMAL(18,4),
ADD COLUMN     "unitCostSnapshot" DECIMAL(18,4);
