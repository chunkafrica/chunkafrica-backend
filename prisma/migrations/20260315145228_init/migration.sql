-- CreateEnum
CREATE TYPE "StoreType" AS ENUM ('PHYSICAL', 'ONLINE');

-- CreateEnum
CREATE TYPE "InventoryItemType" AS ENUM ('RAW_MATERIAL', 'FINISHED_GOOD', 'PACKAGING');

-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('STOCK_IN', 'PRODUCTION_USE', 'PRODUCTION_OUTPUT', 'WASTE', 'INVENTORY_ADJUSTMENT', 'SALE');

-- CreateEnum
CREATE TYPE "SalesChannel" AS ENUM ('WALK_IN', 'WHATSAPP', 'INSTAGRAM', 'WEBSITE', 'CHOWDECK', 'GLOVO', 'EVENT');

-- CreateEnum
CREATE TYPE "SalesOrderStatus" AS ENUM ('NEW', 'PREPARING', 'READY_FOR_DELIVERY', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('UNPAID', 'PARTIALLY_PAID', 'PAID', 'REFUNDED');

-- CreateEnum
CREATE TYPE "ProductionBatchStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReconciliationStatus" AS ENUM ('DRAFT', 'POSTED');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'VOID');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'BANK_TRANSFER', 'CARD', 'TRANSFER', 'OTHER');

-- CreateTable
CREATE TABLE "Business" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "legalName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "currencyCode" VARCHAR(3) NOT NULL DEFAULT 'NGN',
    "timezone" TEXT NOT NULL DEFAULT 'Africa/Lagos',
    "address" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Business_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Store" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "storeType" "StoreType" NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Store_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isSystemRole" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "roleId" UUID NOT NULL,
    "primaryStoreId" UUID,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "passwordHash" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "contactName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryItem" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT,
    "description" TEXT,
    "itemType" "InventoryItemType" NOT NULL,
    "unitOfMeasure" TEXT NOT NULL,
    "defaultCostPerUnit" DECIMAL(18,4),
    "defaultSellingPrice" DECIMAL(18,4),
    "restockPoint" DECIMAL(18,4),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "trackExpiry" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MenuItem" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "defaultPrice" DECIMAL(18,4) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "MenuItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recipe" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "menuItemId" UUID NOT NULL,
    "producedInventoryItemId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "yieldQuantity" DECIMAL(18,4) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "instructions" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Recipe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeItem" (
    "id" UUID NOT NULL,
    "recipeId" UUID NOT NULL,
    "inventoryItemId" UUID NOT NULL,
    "quantityRequired" DECIMAL(18,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecipeItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockInRecord" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "supplierId" UUID,
    "createdByUserId" UUID NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "externalReference" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockInRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockInItem" (
    "id" UUID NOT NULL,
    "stockInRecordId" UUID NOT NULL,
    "inventoryItemId" UUID NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "unitCost" DECIMAL(18,4) NOT NULL,
    "totalCost" DECIMAL(18,4) NOT NULL,
    "expiryDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockInItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionBatch" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "menuItemId" UUID NOT NULL,
    "recipeId" UUID NOT NULL,
    "producedInventoryItemId" UUID NOT NULL,
    "createdByUserId" UUID NOT NULL,
    "batchNumber" TEXT,
    "recipeVersionUsed" INTEGER NOT NULL,
    "batchDate" TIMESTAMP(3) NOT NULL,
    "plannedOutputQuantity" DECIMAL(18,4),
    "actualOutputQuantity" DECIMAL(18,4) NOT NULL,
    "status" "ProductionBatchStatus" NOT NULL DEFAULT 'PLANNED',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductionBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionBatchIngredient" (
    "id" UUID NOT NULL,
    "productionBatchId" UUID NOT NULL,
    "inventoryItemId" UUID NOT NULL,
    "expectedQuantity" DECIMAL(18,4) NOT NULL,
    "actualQuantity" DECIMAL(18,4) NOT NULL,
    "varianceQuantity" DECIMAL(18,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductionBatchIngredient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WasteCategory" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "WasteCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WasteLog" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "inventoryItemId" UUID NOT NULL,
    "wasteCategoryId" UUID NOT NULL,
    "createdByUserId" UUID NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "costAtLossSnapshot" DECIMAL(18,4),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WasteLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesOrder" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "customerId" UUID,
    "createdByUserId" UUID NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "channel" "SalesChannel" NOT NULL,
    "orderStatus" "SalesOrderStatus" NOT NULL DEFAULT 'NEW',
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "orderedAt" TIMESTAMP(3) NOT NULL,
    "subtotal" DECIMAL(18,4) NOT NULL,
    "discount" DECIMAL(18,4) NOT NULL,
    "tax" DECIMAL(18,4) NOT NULL,
    "total" DECIMAL(18,4) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesOrderItem" (
    "id" UUID NOT NULL,
    "salesOrderId" UUID NOT NULL,
    "menuItemId" UUID NOT NULL,
    "fulfilledInventoryItemId" UUID NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "unitPrice" DECIMAL(18,4) NOT NULL,
    "lineTotal" DECIMAL(18,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "salesOrderId" UUID NOT NULL,
    "createdByUserId" UUID NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "issueDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3),
    "subtotal" DECIMAL(18,4) NOT NULL,
    "discount" DECIMAL(18,4) NOT NULL,
    "tax" DECIMAL(18,4) NOT NULL,
    "total" DECIMAL(18,4) NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Receipt" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "salesOrderId" UUID NOT NULL,
    "createdByUserId" UUID NOT NULL,
    "receiptNumber" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL,
    "amountPaid" DECIMAL(18,4) NOT NULL,
    "paymentMethod" "PaymentMethod" NOT NULL,
    "paymentReference" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Receipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "supplierId" UUID,
    "createdByUserId" UUID NOT NULL,
    "category" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "incurredAt" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryReconciliation" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "createdByUserId" UUID NOT NULL,
    "status" "ReconciliationStatus" NOT NULL DEFAULT 'DRAFT',
    "startedAt" TIMESTAMP(3) NOT NULL,
    "postedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryReconciliation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReconciliationItem" (
    "id" UUID NOT NULL,
    "inventoryReconciliationId" UUID NOT NULL,
    "inventoryItemId" UUID NOT NULL,
    "expectedQuantity" DECIMAL(18,4) NOT NULL,
    "actualQuantity" DECIMAL(18,4) NOT NULL,
    "varianceQuantity" DECIMAL(18,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReconciliationItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "inventoryItemId" UUID NOT NULL,
    "createdByUserId" UUID NOT NULL,
    "movementType" "StockMovementType" NOT NULL,
    "quantityChange" DECIMAL(18,4) NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "stockInItemId" UUID,
    "productionBatchIngredientId" UUID,
    "productionBatchId" UUID,
    "wasteLogId" UUID,
    "reconciliationItemId" UUID,
    "salesOrderItemId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Business_deletedAt_idx" ON "Business"("deletedAt");

-- CreateIndex
CREATE INDEX "Store_businessId_storeType_idx" ON "Store"("businessId", "storeType");

-- CreateIndex
CREATE INDEX "Store_businessId_deletedAt_idx" ON "Store"("businessId", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Store_businessId_name_key" ON "Store"("businessId", "name");

-- CreateIndex
CREATE INDEX "Role_businessId_deletedAt_idx" ON "Role"("businessId", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Role_businessId_name_key" ON "Role"("businessId", "name");

-- CreateIndex
CREATE INDEX "User_businessId_roleId_idx" ON "User"("businessId", "roleId");

-- CreateIndex
CREATE INDEX "User_primaryStoreId_idx" ON "User"("primaryStoreId");

-- CreateIndex
CREATE INDEX "User_businessId_deletedAt_idx" ON "User"("businessId", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "User_businessId_email_key" ON "User"("businessId", "email");

-- CreateIndex
CREATE INDEX "Supplier_businessId_deletedAt_idx" ON "Supplier"("businessId", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_businessId_name_key" ON "Supplier"("businessId", "name");

-- CreateIndex
CREATE INDEX "InventoryItem_businessId_name_idx" ON "InventoryItem"("businessId", "name");

-- CreateIndex
CREATE INDEX "InventoryItem_businessId_itemType_idx" ON "InventoryItem"("businessId", "itemType");

-- CreateIndex
CREATE INDEX "InventoryItem_businessId_deletedAt_idx" ON "InventoryItem"("businessId", "deletedAt");

-- CreateIndex
CREATE INDEX "MenuItem_businessId_deletedAt_idx" ON "MenuItem"("businessId", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "MenuItem_businessId_name_key" ON "MenuItem"("businessId", "name");

-- CreateIndex
CREATE INDEX "Recipe_businessId_menuItemId_idx" ON "Recipe"("businessId", "menuItemId");

-- CreateIndex
CREATE INDEX "Recipe_producedInventoryItemId_idx" ON "Recipe"("producedInventoryItemId");

-- CreateIndex
CREATE INDEX "Recipe_businessId_deletedAt_idx" ON "Recipe"("businessId", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Recipe_menuItemId_version_key" ON "Recipe"("menuItemId", "version");

-- CreateIndex
CREATE INDEX "RecipeItem_inventoryItemId_idx" ON "RecipeItem"("inventoryItemId");

-- CreateIndex
CREATE UNIQUE INDEX "RecipeItem_recipeId_inventoryItemId_key" ON "RecipeItem"("recipeId", "inventoryItemId");

-- CreateIndex
CREATE INDEX "StockInRecord_businessId_storeId_receivedAt_idx" ON "StockInRecord"("businessId", "storeId", "receivedAt");

-- CreateIndex
CREATE INDEX "StockInRecord_supplierId_idx" ON "StockInRecord"("supplierId");

-- CreateIndex
CREATE INDEX "StockInRecord_createdByUserId_idx" ON "StockInRecord"("createdByUserId");

-- CreateIndex
CREATE INDEX "StockInItem_stockInRecordId_idx" ON "StockInItem"("stockInRecordId");

-- CreateIndex
CREATE INDEX "StockInItem_inventoryItemId_idx" ON "StockInItem"("inventoryItemId");

-- CreateIndex
CREATE INDEX "StockInItem_expiryDate_idx" ON "StockInItem"("expiryDate");

-- CreateIndex
CREATE INDEX "ProductionBatch_businessId_storeId_batchDate_idx" ON "ProductionBatch"("businessId", "storeId", "batchDate");

-- CreateIndex
CREATE INDEX "ProductionBatch_recipeId_idx" ON "ProductionBatch"("recipeId");

-- CreateIndex
CREATE INDEX "ProductionBatch_createdByUserId_idx" ON "ProductionBatch"("createdByUserId");

-- CreateIndex
CREATE INDEX "ProductionBatch_status_idx" ON "ProductionBatch"("status");

-- CreateIndex
CREATE INDEX "ProductionBatch_businessId_batchNumber_idx" ON "ProductionBatch"("businessId", "batchNumber");

-- CreateIndex
CREATE INDEX "ProductionBatchIngredient_inventoryItemId_idx" ON "ProductionBatchIngredient"("inventoryItemId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionBatchIngredient_productionBatchId_inventoryItemId_key" ON "ProductionBatchIngredient"("productionBatchId", "inventoryItemId");

-- CreateIndex
CREATE INDEX "WasteCategory_businessId_deletedAt_idx" ON "WasteCategory"("businessId", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "WasteCategory_businessId_name_key" ON "WasteCategory"("businessId", "name");

-- CreateIndex
CREATE INDEX "WasteLog_businessId_storeId_occurredAt_idx" ON "WasteLog"("businessId", "storeId", "occurredAt");

-- CreateIndex
CREATE INDEX "WasteLog_inventoryItemId_idx" ON "WasteLog"("inventoryItemId");

-- CreateIndex
CREATE INDEX "WasteLog_wasteCategoryId_idx" ON "WasteLog"("wasteCategoryId");

-- CreateIndex
CREATE INDEX "WasteLog_createdByUserId_idx" ON "WasteLog"("createdByUserId");

-- CreateIndex
CREATE INDEX "Customer_businessId_name_idx" ON "Customer"("businessId", "name");

-- CreateIndex
CREATE INDEX "Customer_businessId_phone_idx" ON "Customer"("businessId", "phone");

-- CreateIndex
CREATE INDEX "Customer_businessId_deletedAt_idx" ON "Customer"("businessId", "deletedAt");

-- CreateIndex
CREATE INDEX "SalesOrder_businessId_storeId_orderedAt_idx" ON "SalesOrder"("businessId", "storeId", "orderedAt");

-- CreateIndex
CREATE INDEX "SalesOrder_customerId_idx" ON "SalesOrder"("customerId");

-- CreateIndex
CREATE INDEX "SalesOrder_channel_idx" ON "SalesOrder"("channel");

-- CreateIndex
CREATE INDEX "SalesOrder_orderStatus_idx" ON "SalesOrder"("orderStatus");

-- CreateIndex
CREATE INDEX "SalesOrder_paymentStatus_idx" ON "SalesOrder"("paymentStatus");

-- CreateIndex
CREATE INDEX "SalesOrder_createdByUserId_idx" ON "SalesOrder"("createdByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "SalesOrder_businessId_orderNumber_key" ON "SalesOrder"("businessId", "orderNumber");

-- CreateIndex
CREATE INDEX "SalesOrderItem_salesOrderId_idx" ON "SalesOrderItem"("salesOrderId");

-- CreateIndex
CREATE INDEX "SalesOrderItem_menuItemId_idx" ON "SalesOrderItem"("menuItemId");

-- CreateIndex
CREATE INDEX "SalesOrderItem_fulfilledInventoryItemId_idx" ON "SalesOrderItem"("fulfilledInventoryItemId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_salesOrderId_key" ON "Invoice"("salesOrderId");

-- CreateIndex
CREATE INDEX "Invoice_businessId_storeId_issueDate_idx" ON "Invoice"("businessId", "storeId", "issueDate");

-- CreateIndex
CREATE INDEX "Invoice_status_idx" ON "Invoice"("status");

-- CreateIndex
CREATE INDEX "Invoice_createdByUserId_idx" ON "Invoice"("createdByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_businessId_invoiceNumber_key" ON "Invoice"("businessId", "invoiceNumber");

-- CreateIndex
CREATE INDEX "Receipt_businessId_storeId_issuedAt_idx" ON "Receipt"("businessId", "storeId", "issuedAt");

-- CreateIndex
CREATE INDEX "Receipt_paymentMethod_idx" ON "Receipt"("paymentMethod");

-- CreateIndex
CREATE INDEX "Receipt_createdByUserId_idx" ON "Receipt"("createdByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Receipt_businessId_receiptNumber_key" ON "Receipt"("businessId", "receiptNumber");

-- CreateIndex
CREATE INDEX "Expense_businessId_storeId_incurredAt_idx" ON "Expense"("businessId", "storeId", "incurredAt");

-- CreateIndex
CREATE INDEX "Expense_supplierId_idx" ON "Expense"("supplierId");

-- CreateIndex
CREATE INDEX "Expense_createdByUserId_idx" ON "Expense"("createdByUserId");

-- CreateIndex
CREATE INDEX "Expense_category_idx" ON "Expense"("category");

-- CreateIndex
CREATE INDEX "InventoryReconciliation_businessId_storeId_startedAt_idx" ON "InventoryReconciliation"("businessId", "storeId", "startedAt");

-- CreateIndex
CREATE INDEX "InventoryReconciliation_status_idx" ON "InventoryReconciliation"("status");

-- CreateIndex
CREATE INDEX "InventoryReconciliation_createdByUserId_idx" ON "InventoryReconciliation"("createdByUserId");

-- CreateIndex
CREATE INDEX "ReconciliationItem_inventoryItemId_idx" ON "ReconciliationItem"("inventoryItemId");

-- CreateIndex
CREATE UNIQUE INDEX "ReconciliationItem_inventoryReconciliationId_inventoryItemI_key" ON "ReconciliationItem"("inventoryReconciliationId", "inventoryItemId");

-- CreateIndex
CREATE UNIQUE INDEX "StockMovement_stockInItemId_key" ON "StockMovement"("stockInItemId");

-- CreateIndex
CREATE UNIQUE INDEX "StockMovement_productionBatchIngredientId_key" ON "StockMovement"("productionBatchIngredientId");

-- CreateIndex
CREATE UNIQUE INDEX "StockMovement_productionBatchId_key" ON "StockMovement"("productionBatchId");

-- CreateIndex
CREATE UNIQUE INDEX "StockMovement_wasteLogId_key" ON "StockMovement"("wasteLogId");

-- CreateIndex
CREATE UNIQUE INDEX "StockMovement_reconciliationItemId_key" ON "StockMovement"("reconciliationItemId");

-- CreateIndex
CREATE UNIQUE INDEX "StockMovement_salesOrderItemId_key" ON "StockMovement"("salesOrderItemId");

-- CreateIndex
CREATE INDEX "StockMovement_businessId_storeId_occurredAt_idx" ON "StockMovement"("businessId", "storeId", "occurredAt");

-- CreateIndex
CREATE INDEX "StockMovement_inventoryItemId_occurredAt_idx" ON "StockMovement"("inventoryItemId", "occurredAt");

-- CreateIndex
CREATE INDEX "StockMovement_businessId_movementType_occurredAt_idx" ON "StockMovement"("businessId", "movementType", "occurredAt");

-- CreateIndex
CREATE INDEX "StockMovement_createdByUserId_idx" ON "StockMovement"("createdByUserId");

-- AddForeignKey
ALTER TABLE "Store" ADD CONSTRAINT "Store_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Role" ADD CONSTRAINT "Role_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_primaryStoreId_fkey" FOREIGN KEY ("primaryStoreId") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recipe" ADD CONSTRAINT "Recipe_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recipe" ADD CONSTRAINT "Recipe_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recipe" ADD CONSTRAINT "Recipe_producedInventoryItemId_fkey" FOREIGN KEY ("producedInventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeItem" ADD CONSTRAINT "RecipeItem_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeItem" ADD CONSTRAINT "RecipeItem_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockInRecord" ADD CONSTRAINT "StockInRecord_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockInRecord" ADD CONSTRAINT "StockInRecord_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockInRecord" ADD CONSTRAINT "StockInRecord_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockInRecord" ADD CONSTRAINT "StockInRecord_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockInItem" ADD CONSTRAINT "StockInItem_stockInRecordId_fkey" FOREIGN KEY ("stockInRecordId") REFERENCES "StockInRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockInItem" ADD CONSTRAINT "StockInItem_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionBatch" ADD CONSTRAINT "ProductionBatch_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionBatch" ADD CONSTRAINT "ProductionBatch_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionBatch" ADD CONSTRAINT "ProductionBatch_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionBatch" ADD CONSTRAINT "ProductionBatch_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionBatch" ADD CONSTRAINT "ProductionBatch_producedInventoryItemId_fkey" FOREIGN KEY ("producedInventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionBatch" ADD CONSTRAINT "ProductionBatch_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionBatchIngredient" ADD CONSTRAINT "ProductionBatchIngredient_productionBatchId_fkey" FOREIGN KEY ("productionBatchId") REFERENCES "ProductionBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionBatchIngredient" ADD CONSTRAINT "ProductionBatchIngredient_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WasteCategory" ADD CONSTRAINT "WasteCategory_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WasteLog" ADD CONSTRAINT "WasteLog_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WasteLog" ADD CONSTRAINT "WasteLog_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WasteLog" ADD CONSTRAINT "WasteLog_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WasteLog" ADD CONSTRAINT "WasteLog_wasteCategoryId_fkey" FOREIGN KEY ("wasteCategoryId") REFERENCES "WasteCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WasteLog" ADD CONSTRAINT "WasteLog_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrderItem" ADD CONSTRAINT "SalesOrderItem_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrderItem" ADD CONSTRAINT "SalesOrderItem_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrderItem" ADD CONSTRAINT "SalesOrderItem_fulfilledInventoryItemId_fkey" FOREIGN KEY ("fulfilledInventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryReconciliation" ADD CONSTRAINT "InventoryReconciliation_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryReconciliation" ADD CONSTRAINT "InventoryReconciliation_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryReconciliation" ADD CONSTRAINT "InventoryReconciliation_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReconciliationItem" ADD CONSTRAINT "ReconciliationItem_inventoryReconciliationId_fkey" FOREIGN KEY ("inventoryReconciliationId") REFERENCES "InventoryReconciliation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReconciliationItem" ADD CONSTRAINT "ReconciliationItem_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_stockInItemId_fkey" FOREIGN KEY ("stockInItemId") REFERENCES "StockInItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_productionBatchIngredientId_fkey" FOREIGN KEY ("productionBatchIngredientId") REFERENCES "ProductionBatchIngredient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_productionBatchId_fkey" FOREIGN KEY ("productionBatchId") REFERENCES "ProductionBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_wasteLogId_fkey" FOREIGN KEY ("wasteLogId") REFERENCES "WasteLog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_reconciliationItemId_fkey" FOREIGN KEY ("reconciliationItemId") REFERENCES "ReconciliationItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_salesOrderItemId_fkey" FOREIGN KEY ("salesOrderItemId") REFERENCES "SalesOrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
