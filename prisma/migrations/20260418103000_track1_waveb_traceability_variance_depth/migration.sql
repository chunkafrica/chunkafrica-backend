-- AlterTable
ALTER TABLE "ProductionBatch"
ADD COLUMN "varianceReasonCode" TEXT;

-- AlterTable
ALTER TABLE "StockMovement"
ADD COLUMN "sourceStockMovementId" UUID;

-- CreateIndex
CREATE INDEX "StockMovement_sourceStockMovementId_idx" ON "StockMovement"("sourceStockMovementId");

-- AddForeignKey
ALTER TABLE "StockMovement"
ADD CONSTRAINT "StockMovement_sourceStockMovementId_fkey"
FOREIGN KEY ("sourceStockMovementId") REFERENCES "StockMovement"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
