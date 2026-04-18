-- AlterTable
ALTER TABLE "ProductionBatch"
ADD COLUMN "expectedCostBasisSource" TEXT,
ADD COLUMN "expectedCostBasisAt" TIMESTAMP(3);
