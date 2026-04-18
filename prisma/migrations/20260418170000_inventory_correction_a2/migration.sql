-- AlterEnum
ALTER TYPE "ReconciliationStatus" ADD VALUE 'READY';

-- CreateEnum
CREATE TYPE "InventoryAdjustmentReasonCode" AS ENUM (
  'COUNT_VARIANCE',
  'MISRECEIPT',
  'DAMAGE_FOUND',
  'OPENING_BALANCE_FIX',
  'UOM_FIX'
);

-- AlterTable
ALTER TABLE "InventoryReconciliation"
ADD COLUMN "lastEditedByUserId" UUID,
ADD COLUMN "sourceStockInRecordId" UUID,
ADD COLUMN "correctionIntent" VARCHAR(120);

-- AlterTable
ALTER TABLE "ReconciliationItem"
ADD COLUMN "reasonCode" "InventoryAdjustmentReasonCode",
ADD COLUMN "note" TEXT;

-- AlterTable
ALTER TABLE "StockMovement"
ADD COLUMN "adjustmentReasonCode" "InventoryAdjustmentReasonCode",
ADD COLUMN "sourceStockInRecordId" UUID;

-- CreateIndex
CREATE INDEX "InventoryReconciliation_lastEditedByUserId_idx" ON "InventoryReconciliation"("lastEditedByUserId");

-- CreateIndex
CREATE INDEX "InventoryReconciliation_sourceStockInRecordId_idx" ON "InventoryReconciliation"("sourceStockInRecordId");

-- CreateIndex
CREATE INDEX "StockMovement_sourceStockInRecordId_idx" ON "StockMovement"("sourceStockInRecordId");

-- AddForeignKey
ALTER TABLE "InventoryReconciliation"
ADD CONSTRAINT "InventoryReconciliation_lastEditedByUserId_fkey" FOREIGN KEY ("lastEditedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryReconciliation"
ADD CONSTRAINT "InventoryReconciliation_sourceStockInRecordId_fkey" FOREIGN KEY ("sourceStockInRecordId") REFERENCES "StockInRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement"
ADD CONSTRAINT "StockMovement_sourceStockInRecordId_fkey" FOREIGN KEY ("sourceStockInRecordId") REFERENCES "StockInRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;
