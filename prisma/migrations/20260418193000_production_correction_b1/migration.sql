-- Production correction and audit trail

ALTER TYPE "ProductionBatchStatus" ADD VALUE IF NOT EXISTS 'CORRECTION_POSTED';

CREATE TYPE "ProductionBatchCorrectionType" AS ENUM ('OUTPUT', 'VARIANCE_REASON');
CREATE TYPE "ProductionBatchEventAction" AS ENUM (
  'CREATED',
  'UPDATED',
  'STARTED',
  'COMPLETED',
  'CANCELLED',
  'CORRECTED',
  'VARIANCE_REASON_CORRECTED'
);

ALTER TABLE "ProductionBatch"
ADD COLUMN "effectiveActualOutputQuantity" DECIMAL(18,4),
ADD COLUMN "effectiveOutputVarianceQuantity" DECIMAL(18,4),
ADD COLUMN "effectiveVarianceReasonCode" TEXT,
ADD COLUMN "lastCorrectionAt" TIMESTAMP(3);

UPDATE "ProductionBatch"
SET
  "effectiveActualOutputQuantity" = "actualOutputQuantity",
  "effectiveOutputVarianceQuantity" = "outputVarianceQuantity",
  "effectiveVarianceReasonCode" = "varianceReasonCode"
WHERE "status" = 'COMPLETED';

CREATE TABLE "ProductionBatchCorrection" (
  "id" UUID NOT NULL,
  "businessId" UUID NOT NULL,
  "storeId" UUID NOT NULL,
  "productionBatchId" UUID NOT NULL,
  "actorUserId" UUID NOT NULL,
  "correctionType" "ProductionBatchCorrectionType" NOT NULL,
  "reason" TEXT NOT NULL,
  "note" TEXT NOT NULL,
  "previousActualOutputQuantity" DECIMAL(18,4),
  "correctedActualOutputQuantity" DECIMAL(18,4),
  "outputDeltaQuantity" DECIMAL(18,4),
  "previousVarianceReasonCode" TEXT,
  "correctedVarianceReasonCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ProductionBatchCorrection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProductionBatchEvent" (
  "id" UUID NOT NULL,
  "businessId" UUID NOT NULL,
  "storeId" UUID NOT NULL,
  "productionBatchId" UUID NOT NULL,
  "actorUserId" UUID NOT NULL,
  "action" "ProductionBatchEventAction" NOT NULL,
  "reason" TEXT NOT NULL,
  "note" TEXT,
  "beforeSummary" JSONB,
  "afterSummary" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ProductionBatchEvent_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "StockMovement"
ADD COLUMN "productionBatchCorrectionId" UUID;

CREATE INDEX "ProductionBatch_lastCorrectionAt_idx" ON "ProductionBatch"("lastCorrectionAt");
CREATE INDEX "ProductionBatchCorrection_businessId_storeId_createdAt_idx" ON "ProductionBatchCorrection"("businessId", "storeId", "createdAt");
CREATE INDEX "ProductionBatchCorrection_productionBatchId_createdAt_idx" ON "ProductionBatchCorrection"("productionBatchId", "createdAt");
CREATE INDEX "ProductionBatchCorrection_actorUserId_idx" ON "ProductionBatchCorrection"("actorUserId");
CREATE INDEX "ProductionBatchEvent_businessId_storeId_createdAt_idx" ON "ProductionBatchEvent"("businessId", "storeId", "createdAt");
CREATE INDEX "ProductionBatchEvent_productionBatchId_createdAt_idx" ON "ProductionBatchEvent"("productionBatchId", "createdAt");
CREATE INDEX "ProductionBatchEvent_actorUserId_idx" ON "ProductionBatchEvent"("actorUserId");
CREATE INDEX "StockMovement_productionBatchCorrectionId_idx" ON "StockMovement"("productionBatchCorrectionId");

ALTER TABLE "ProductionBatchCorrection"
ADD CONSTRAINT "ProductionBatchCorrection_businessId_fkey"
FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProductionBatchCorrection"
ADD CONSTRAINT "ProductionBatchCorrection_storeId_fkey"
FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProductionBatchCorrection"
ADD CONSTRAINT "ProductionBatchCorrection_productionBatchId_fkey"
FOREIGN KEY ("productionBatchId") REFERENCES "ProductionBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProductionBatchCorrection"
ADD CONSTRAINT "ProductionBatchCorrection_actorUserId_fkey"
FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProductionBatchEvent"
ADD CONSTRAINT "ProductionBatchEvent_businessId_fkey"
FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProductionBatchEvent"
ADD CONSTRAINT "ProductionBatchEvent_storeId_fkey"
FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProductionBatchEvent"
ADD CONSTRAINT "ProductionBatchEvent_productionBatchId_fkey"
FOREIGN KEY ("productionBatchId") REFERENCES "ProductionBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProductionBatchEvent"
ADD CONSTRAINT "ProductionBatchEvent_actorUserId_fkey"
FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "StockMovement"
ADD CONSTRAINT "StockMovement_productionBatchCorrectionId_fkey"
FOREIGN KEY ("productionBatchCorrectionId") REFERENCES "ProductionBatchCorrection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
