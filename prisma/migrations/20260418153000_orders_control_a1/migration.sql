-- CreateEnum
CREATE TYPE "SalesOrderControlAction" AS ENUM (
  'CREATED',
  'UPDATED',
  'STATUS_TRANSITIONED',
  'CANCELLED',
  'REOPENED',
  'FULFILLED',
  'RECEIPT_RECORDED'
);

-- CreateEnum
CREATE TYPE "SalesOrderReasonCode" AS ENUM (
  'ORDER_CREATED',
  'METADATA_CORRECTION',
  'COMMERCIAL_CORRECTION',
  'STATUS_TRANSITION',
  'CANCEL_CUSTOMER_REQUEST',
  'CANCEL_DUPLICATE',
  'CANCEL_OPERATOR_ERROR',
  'REOPEN_CUSTOMER_REQUEST',
  'REOPEN_OPERATOR_ERROR',
  'FULFILLMENT_POSTED',
  'RECEIPT_RECORDED'
);

-- CreateTable
CREATE TABLE "SalesOrderEvent" (
  "id" UUID NOT NULL,
  "businessId" UUID NOT NULL,
  "storeId" UUID NOT NULL,
  "salesOrderId" UUID NOT NULL,
  "actorUserId" UUID NOT NULL,
  "action" "SalesOrderControlAction" NOT NULL,
  "reasonCode" "SalesOrderReasonCode" NOT NULL,
  "note" TEXT,
  "beforeSummary" JSONB,
  "afterSummary" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SalesOrderEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SalesOrderEvent_businessId_storeId_createdAt_idx" ON "SalesOrderEvent"("businessId", "storeId", "createdAt");

-- CreateIndex
CREATE INDEX "SalesOrderEvent_salesOrderId_createdAt_idx" ON "SalesOrderEvent"("salesOrderId", "createdAt");

-- CreateIndex
CREATE INDEX "SalesOrderEvent_actorUserId_idx" ON "SalesOrderEvent"("actorUserId");

-- CreateIndex
CREATE INDEX "SalesOrderEvent_reasonCode_idx" ON "SalesOrderEvent"("reasonCode");

-- AddForeignKey
ALTER TABLE "SalesOrderEvent"
ADD CONSTRAINT "SalesOrderEvent_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrderEvent"
ADD CONSTRAINT "SalesOrderEvent_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrderEvent"
ADD CONSTRAINT "SalesOrderEvent_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrderEvent"
ADD CONSTRAINT "SalesOrderEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
