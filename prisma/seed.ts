import 'dotenv/config';
import {
  InventoryItemType,
  InvoiceStatus,
  PaymentMethod,
  PaymentStatus,
  PrismaClient,
  ProductionBatchStatus,
  ReconciliationStatus,
  SalesChannel,
  SalesOrderStatus,
  StockMovementType,
  StoreType,
} from '@prisma/client';

const ids = {
  business: '22222222-2222-2222-2222-222222222222',
  role: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  store: '33333333-3333-3333-3333-333333333333',
  user: '11111111-1111-1111-1111-111111111111',
  supplier: '6bb43626-dce6-41a2-a0a5-0b33098bcfe6',
  customer: 'dc2c92a3-d8a1-4806-97fe-696ee5ca2b58',
  inventory: {
    tomatoes: '36280608-ba65-407d-a0a8-a4f3b1f74bfe',
    turkeyFilling: 'ab9dd3a7-ce14-4cfc-9315-d95335dacd69',
    pastryFlour: 'aac8fb80-4339-4387-85ea-8a0db6708de2',
    tomatoSoupBowl: '39d104da-cff4-4e30-a5fc-4b73a35b22c7',
    turkeyPie: '825562c4-92fc-4162-93b4-c78f206acbf1',
    legacySoupBowl: 'a4e72924-3997-4cd4-b1ea-0e4a98b5a477',
    legacyFlour: '913b8314-9687-4d8d-b737-a4bb25f34e5b',
    legacyPie: 'e6fb8a57-f106-4656-9e92-b2f0cf92a2a3',
  },
  menu: {
    tomatoSoup: '2fdf63c8-e318-4c26-b763-ada1ce76bb54',
    turkeyPie: '75e33e77-e4df-4d66-81e2-53975cdf5576',
  },
  recipe: {
    tomatoSoup: '8fb8b435-fe15-4c03-9e6c-228e6433af2c',
    turkeyPie: '16704c63-b42e-4aab-b050-bf630441f03a',
  },
  recipeItems: {
    tomatoSoupTomatoes: '1ba4be00-f145-4fd8-b74a-0c1bd4bd3001',
    turkeyPieFlour: '9f335400-9ca1-48ba-8aa9-a885a9d16f91',
    turkeyPieFilling: 'aabef773-a8aa-4a4b-b97f-ca4a1f7be001',
  },
  stockIn: {
    tomatoesRecord: '4d95ef81-fb07-4ef0-88f7-9e7044f10001',
    tomatoesItem: '4d95ef81-fb07-4ef0-88f7-9e7044f10002',
    tomatoesMovement: '4d95ef81-fb07-4ef0-88f7-9e7044f10003',
    flourRecord: 'aa43548c-f817-4d13-bc97-4db126a11bcd',
    flourItem: '4d95ef81-fb07-4ef0-88f7-9e7044f10005',
    flourMovement: '4d95ef81-fb07-4ef0-88f7-9e7044f10006',
    fillingRecord: '8230e368-d185-4d24-90ac-7cddc6561e05',
    fillingItem: '4d95ef81-fb07-4ef0-88f7-9e7044f10008',
    fillingMovement: '4d95ef81-fb07-4ef0-88f7-9e7044f10009',
  },
  production: {
    tomatoSoupBatch: '756e4991-210c-4ad8-8932-0d8edc1b5eb4',
    tomatoSoupTomatoesIngredient: '4d95ef81-fb07-4ef0-88f7-9e7044f10011',
    tomatoSoupTomatoesMovement: '4d95ef81-fb07-4ef0-88f7-9e7044f10012',
    tomatoSoupOutputMovement: '4d95ef81-fb07-4ef0-88f7-9e7044f10013',
    turkeyPieBatch: 'c29f1cc6-7d20-4680-aca1-feada06c4927',
    turkeyPieFlourIngredient: '4d95ef81-fb07-4ef0-88f7-9e7044f10015',
    turkeyPieFlourMovement: '4d95ef81-fb07-4ef0-88f7-9e7044f10016',
    turkeyPieFillingIngredient: '4d95ef81-fb07-4ef0-88f7-9e7044f10017',
    turkeyPieFillingMovement: '4d95ef81-fb07-4ef0-88f7-9e7044f10018',
    turkeyPieOutputMovement: '4d95ef81-fb07-4ef0-88f7-9e7044f10019',
  },
  waste: {
    category: '4d95ef81-fb07-4ef0-88f7-9e7044f10021',
    log: '79c35b4e-f141-4db7-9794-4ffdcfeb636a',
    movement: '4d95ef81-fb07-4ef0-88f7-9e7044f10023',
  },
  sales: {
    order: '1acaae71-66fb-4126-98f9-e31c82d3f6d3',
    orderItem: '4d95ef81-fb07-4ef0-88f7-9e7044f10025',
    saleMovement: '4d95ef81-fb07-4ef0-88f7-9e7044f10026',
    receipt: 'b4a6dbae-5ac0-4620-a9c2-394f2d359756',
    invoice: '4d95ef81-fb07-4ef0-88f7-9e7044f10028',
  },
  finance: {
    expense: '4d95ef81-fb07-4ef0-88f7-9e7044f10029',
  },
  reconciliation: {
    session: '4d95ef81-fb07-4ef0-88f7-9e7044f10030',
    item: '4d95ef81-fb07-4ef0-88f7-9e7044f10031',
    movement: '4d95ef81-fb07-4ef0-88f7-9e7044f10032',
  },
};

const snackitValidationUserEmail = 'validation@chunk.local';
const fashionValidationUserEmail = 'fashion.validation@chunk.local';
const archiveTimestamp = new Date('2026-04-09T00:00:00.000Z');

const dates = {
  tomatoesStockIn: new Date('2026-04-03T09:00:00.000Z'),
  flourStockIn: new Date('2026-04-04T08:00:00.000Z'),
  fillingStockIn: new Date('2026-04-04T14:27:00.000Z'),
  tomatoSoupBatch: new Date('2026-04-05T10:00:00.000Z'),
  turkeyPieBatch: new Date('2026-04-07T09:30:00.000Z'),
  waste: new Date('2026-04-07T16:15:00.000Z'),
  order: new Date('2026-04-08T22:49:00.000Z'),
  receipt: new Date('2026-04-08T22:49:00.000Z'),
  invoiceIssue: new Date('2026-04-08T22:55:00.000Z'),
  invoiceDue: new Date('2026-04-10T18:00:00.000Z'),
  expense: new Date('2026-04-08T12:00:00.000Z'),
  reconciliationStart: new Date('2026-04-09T07:30:00.000Z'),
  reconciliationPosted: new Date('2026-04-09T08:10:00.000Z'),
};

const fashionIds = {
  business: '44444444-4444-4444-4444-444444444444',
  role: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
  store: '55555555-5555-5555-5555-555555555555',
  user: '66666666-6666-6666-6666-666666666666',
  supplier: '7a1c3f00-0000-4000-8000-000000000001',
  customer: '7a1c3f00-0000-4000-8000-000000000002',
  inventory: {
    cottonTwill: '7a1c3f00-0000-4000-8000-000000000003',
    satinLining: '7a1c3f00-0000-4000-8000-000000000004',
    metalZip: '7a1c3f00-0000-4000-8000-000000000005',
    utilityJacketUnit: '7a1c3f00-0000-4000-8000-000000000006',
  },
  menu: {
    utilityJacket: '7a1c3f00-0000-4000-8000-000000000007',
  },
  recipe: {
    utilityJacket: '7a1c3f00-0000-4000-8000-000000000008',
  },
  recipeItems: {
    jacketTwill: '7a1c3f00-0000-4000-8000-000000000009',
    jacketLining: '7a1c3f00-0000-4000-8000-000000000010',
    jacketZip: '7a1c3f00-0000-4000-8000-000000000011',
  },
  stockIn: {
    twillRecord: '7a1c3f00-0000-4000-8000-000000000012',
    twillItem: '7a1c3f00-0000-4000-8000-000000000013',
    twillMovement: '7a1c3f00-0000-4000-8000-000000000014',
    liningRecord: '7a1c3f00-0000-4000-8000-000000000015',
    liningItem: '7a1c3f00-0000-4000-8000-000000000016',
    liningMovement: '7a1c3f00-0000-4000-8000-000000000017',
    zipRecord: '7a1c3f00-0000-4000-8000-000000000018',
    zipItem: '7a1c3f00-0000-4000-8000-000000000019',
    zipMovement: '7a1c3f00-0000-4000-8000-000000000020',
  },
  production: {
    jacketBatch: '7a1c3f00-0000-4000-8000-000000000021',
    jacketTwillIngredient: '7a1c3f00-0000-4000-8000-000000000022',
    jacketTwillMovement: '7a1c3f00-0000-4000-8000-000000000023',
    jacketLiningIngredient: '7a1c3f00-0000-4000-8000-000000000024',
    jacketLiningMovement: '7a1c3f00-0000-4000-8000-000000000025',
    jacketZipIngredient: '7a1c3f00-0000-4000-8000-000000000026',
    jacketZipMovement: '7a1c3f00-0000-4000-8000-000000000027',
    jacketOutputMovement: '7a1c3f00-0000-4000-8000-000000000028',
  },
  waste: {
    category: '7a1c3f00-0000-4000-8000-000000000029',
    log: '7a1c3f00-0000-4000-8000-000000000030',
    movement: '7a1c3f00-0000-4000-8000-000000000031',
  },
  sales: {
    order: '7a1c3f00-0000-4000-8000-000000000032',
    orderItem: '7a1c3f00-0000-4000-8000-000000000033',
    saleMovement: '7a1c3f00-0000-4000-8000-000000000034',
    receipt: '7a1c3f00-0000-4000-8000-000000000035',
    invoice: '7a1c3f00-0000-4000-8000-000000000036',
  },
  finance: {
    expense: '7a1c3f00-0000-4000-8000-000000000037',
  },
  reconciliation: {
    session: '7a1c3f00-0000-4000-8000-000000000038',
    item: '7a1c3f00-0000-4000-8000-000000000039',
    movement: '7a1c3f00-0000-4000-8000-000000000040',
  },
};

const fashionDates = {
  twillStockIn: new Date('2026-04-02T09:00:00.000Z'),
  liningStockIn: new Date('2026-04-03T11:00:00.000Z'),
  zipStockIn: new Date('2026-04-03T15:30:00.000Z'),
  jacketBatch: new Date('2026-04-05T09:00:00.000Z'),
  waste: new Date('2026-04-06T16:20:00.000Z'),
  order: new Date('2026-04-07T14:15:00.000Z'),
  receipt: new Date('2026-04-08T10:00:00.000Z'),
  invoiceIssue: new Date('2026-04-07T14:30:00.000Z'),
  invoiceDue: new Date('2026-04-12T18:00:00.000Z'),
  expense: new Date('2026-04-06T13:30:00.000Z'),
  reconciliationStart: new Date('2026-04-09T08:00:00.000Z'),
  reconciliationPosted: new Date('2026-04-09T08:25:00.000Z'),
};

async function ensureValidationIdentity(prisma: PrismaClient) {
  const business = await prisma.business.upsert({
    where: { id: ids.business },
    update: {
      name: 'Snackit Validation Workspace',
      currencyCode: 'NGN',
      timezone: 'Africa/Lagos',
      deletedAt: null,
    },
    create: {
      id: ids.business,
      name: 'Snackit Validation Workspace',
      currencyCode: 'NGN',
      timezone: 'Africa/Lagos',
    },
  });

  const role = await prisma.role.upsert({
    where: {
      businessId_name: {
        businessId: ids.business,
        name: 'admin',
      },
    },
    update: {
      description: 'Administrator role for Snackit validation access',
      isSystemRole: true,
      deletedAt: null,
    },
    create: {
      id: ids.role,
      businessId: ids.business,
      name: 'admin',
      description: 'Administrator role for Snackit validation access',
      isSystemRole: true,
    },
  });

  const store = await prisma.store.upsert({
    where: { id: ids.store },
    update: {
      businessId: ids.business,
      name: 'Snackit Validation Store',
      storeType: StoreType.PHYSICAL,
      isActive: true,
      deletedAt: null,
    },
    create: {
      id: ids.store,
      businessId: ids.business,
      name: 'Snackit Validation Store',
      storeType: StoreType.PHYSICAL,
    },
  });

  const user = await prisma.user.upsert({
    where: { id: ids.user },
    update: {
      businessId: ids.business,
      roleId: role.id,
      primaryStoreId: store.id,
      fullName: 'Snackit Validation User',
      email: snackitValidationUserEmail,
      isActive: true,
      deletedAt: null,
    },
    create: {
      id: ids.user,
      businessId: ids.business,
      roleId: role.id,
      primaryStoreId: store.id,
      fullName: 'Snackit Validation User',
      email: snackitValidationUserEmail,
    },
  });

  await prisma.store.updateMany({
    where: {
      businessId: ids.business,
      id: {
        not: ids.store,
      },
      deletedAt: null,
      isActive: true,
    },
    data: {
      isActive: false,
    },
  });

  return { business, role, store, user };
}

async function ensureBusinessEntities(prisma: PrismaClient) {
  const supplier = await prisma.supplier.upsert({
    where: { id: ids.supplier },
    update: {
      businessId: ids.business,
      name: 'FreshMart Suppliers',
      contactName: 'Ade Johnson',
      phone: '08012345678',
      email: 'ade@freshmart.com',
      address: '12 Allen Avenue, Ikeja, Lagos',
      notes: 'Primary raw material partner for the Snackit validation flow.',
      deletedAt: null,
    },
    create: {
      id: ids.supplier,
      businessId: ids.business,
      name: 'FreshMart Suppliers',
      contactName: 'Ade Johnson',
      phone: '08012345678',
      email: 'ade@freshmart.com',
      address: '12 Allen Avenue, Ikeja, Lagos',
      notes: 'Primary raw material partner for the Snackit validation flow.',
    },
  });

  const customer = await prisma.customer.upsert({
    where: { id: ids.customer },
    update: {
      businessId: ids.business,
      name: 'Samuel Ekpemede',
      phone: '07065146514',
      email: 'sekpemede@gmail.com',
      address: 'Lekki Phase 1, Lagos',
      notes: 'Repeat Snackit validation customer for order and invoice review.',
      isActive: true,
      deletedAt: null,
    },
    create: {
      id: ids.customer,
      businessId: ids.business,
      name: 'Samuel Ekpemede',
      phone: '07065146514',
      email: 'sekpemede@gmail.com',
      address: 'Lekki Phase 1, Lagos',
      notes: 'Repeat Snackit validation customer for order and invoice review.',
    },
  });

  return { supplier, customer };
}

async function ensureCatalog(prisma: PrismaClient) {
  await prisma.inventoryItem.upsert({
    where: { id: ids.inventory.tomatoes },
    update: {
      businessId: ids.business,
      name: 'Tomatoes',
      itemType: InventoryItemType.RAW_MATERIAL,
      unitOfMeasure: 'kg',
      defaultCostPerUnit: '600',
      restockPoint: '10',
      isActive: true,
      trackExpiry: true,
      deletedAt: null,
    },
    create: {
      id: ids.inventory.tomatoes,
      businessId: ids.business,
      name: 'Tomatoes',
      itemType: InventoryItemType.RAW_MATERIAL,
      unitOfMeasure: 'kg',
      defaultCostPerUnit: '600',
      restockPoint: '10',
      trackExpiry: true,
    },
  });

  await prisma.inventoryItem.upsert({
    where: { id: ids.inventory.turkeyFilling },
    update: {
      businessId: ids.business,
      name: 'Turkey Filling',
      itemType: InventoryItemType.RAW_MATERIAL,
      unitOfMeasure: 'pcs',
      defaultCostPerUnit: '1200',
      restockPoint: '10',
      isActive: true,
      trackExpiry: true,
      deletedAt: null,
    },
    create: {
      id: ids.inventory.turkeyFilling,
      businessId: ids.business,
      name: 'Turkey Filling',
      itemType: InventoryItemType.RAW_MATERIAL,
      unitOfMeasure: 'pcs',
      defaultCostPerUnit: '1200',
      restockPoint: '10',
      trackExpiry: true,
    },
  });

  await prisma.inventoryItem.upsert({
    where: { id: ids.inventory.pastryFlour },
    update: {
      businessId: ids.business,
      name: 'Pastry Flour',
      itemType: InventoryItemType.RAW_MATERIAL,
      unitOfMeasure: 'kg',
      defaultCostPerUnit: '450',
      restockPoint: '8',
      isActive: true,
      trackExpiry: false,
      deletedAt: null,
    },
    create: {
      id: ids.inventory.pastryFlour,
      businessId: ids.business,
      name: 'Pastry Flour',
      itemType: InventoryItemType.RAW_MATERIAL,
      unitOfMeasure: 'kg',
      defaultCostPerUnit: '450',
      restockPoint: '8',
      trackExpiry: false,
    },
  });

  await prisma.inventoryItem.upsert({
    where: { id: ids.inventory.tomatoSoupBowl },
    update: {
      businessId: ids.business,
      name: 'Tomato Soup Bowl',
      itemType: InventoryItemType.FINISHED_GOOD,
      unitOfMeasure: 'bowl',
      defaultCostPerUnit: '1300',
      defaultSellingPrice: '2500',
      restockPoint: '5',
      isActive: true,
      deletedAt: null,
    },
    create: {
      id: ids.inventory.tomatoSoupBowl,
      businessId: ids.business,
      name: 'Tomato Soup Bowl',
      itemType: InventoryItemType.FINISHED_GOOD,
      unitOfMeasure: 'bowl',
      defaultCostPerUnit: '1300',
      defaultSellingPrice: '2500',
      restockPoint: '5',
    },
  });

  await prisma.inventoryItem.upsert({
    where: { id: ids.inventory.turkeyPie },
    update: {
      businessId: ids.business,
      name: 'Turkey Pie',
      itemType: InventoryItemType.FINISHED_GOOD,
      unitOfMeasure: 'pcs',
      defaultCostPerUnit: '1800',
      defaultSellingPrice: '3500',
      restockPoint: '4',
      isActive: true,
      deletedAt: null,
    },
    create: {
      id: ids.inventory.turkeyPie,
      businessId: ids.business,
      name: 'Turkey Pie',
      itemType: InventoryItemType.FINISHED_GOOD,
      unitOfMeasure: 'pcs',
      defaultCostPerUnit: '1800',
      defaultSellingPrice: '3500',
      restockPoint: '4',
    },
  });

  await prisma.inventoryItem.updateMany({
    where: {
      id: {
        in: [ids.inventory.legacySoupBowl, ids.inventory.legacyFlour, ids.inventory.legacyPie],
      },
      businessId: ids.business,
    },
    data: {
      isActive: false,
      deletedAt: archiveTimestamp,
    },
  });

  await prisma.menuItem.upsert({
    where: { id: ids.menu.tomatoSoup },
    update: {
      businessId: ids.business,
      name: 'Tomato Soup',
      defaultPrice: '2500',
      isActive: true,
      deletedAt: null,
    },
    create: {
      id: ids.menu.tomatoSoup,
      businessId: ids.business,
      name: 'Tomato Soup',
      defaultPrice: '2500',
    },
  });

  await prisma.menuItem.upsert({
    where: { id: ids.menu.turkeyPie },
    update: {
      businessId: ids.business,
      name: 'Turkey Pie',
      defaultPrice: '3500',
      isActive: true,
      deletedAt: null,
    },
    create: {
      id: ids.menu.turkeyPie,
      businessId: ids.business,
      name: 'Turkey Pie',
      defaultPrice: '3500',
    },
  });

  await prisma.recipe.upsert({
    where: { id: ids.recipe.tomatoSoup },
    update: {
      businessId: ids.business,
      menuItemId: ids.menu.tomatoSoup,
      producedInventoryItemId: ids.inventory.tomatoSoupBowl,
      version: 1,
      yieldQuantity: '10',
      isActive: true,
      instructions: 'Cook down tomatoes, season, and portion into ten serving bowls.',
      deletedAt: null,
    },
    create: {
      id: ids.recipe.tomatoSoup,
      businessId: ids.business,
      menuItemId: ids.menu.tomatoSoup,
      producedInventoryItemId: ids.inventory.tomatoSoupBowl,
      version: 1,
      yieldQuantity: '10',
      instructions: 'Cook down tomatoes, season, and portion into ten serving bowls.',
    },
  });

  await prisma.recipe.upsert({
    where: { id: ids.recipe.turkeyPie },
    update: {
      businessId: ids.business,
      menuItemId: ids.menu.turkeyPie,
      producedInventoryItemId: ids.inventory.turkeyPie,
      version: 1,
      yieldQuantity: '10',
      isActive: true,
      instructions: 'Prepare pastry with flour, fill with turkey mix, bake, and cool before dispatch.',
      deletedAt: null,
    },
    create: {
      id: ids.recipe.turkeyPie,
      businessId: ids.business,
      menuItemId: ids.menu.turkeyPie,
      producedInventoryItemId: ids.inventory.turkeyPie,
      version: 1,
      yieldQuantity: '10',
      instructions: 'Prepare pastry with flour, fill with turkey mix, bake, and cool before dispatch.',
    },
  });

  await prisma.recipeItem.upsert({
    where: {
      recipeId_inventoryItemId: {
        recipeId: ids.recipe.tomatoSoup,
        inventoryItemId: ids.inventory.tomatoes,
      },
    },
    update: {
      quantityRequired: '20',
    },
    create: {
      id: ids.recipeItems.tomatoSoupTomatoes,
      recipeId: ids.recipe.tomatoSoup,
      inventoryItemId: ids.inventory.tomatoes,
      quantityRequired: '20',
    },
  });

  await prisma.recipeItem.upsert({
    where: {
      recipeId_inventoryItemId: {
        recipeId: ids.recipe.turkeyPie,
        inventoryItemId: ids.inventory.pastryFlour,
      },
    },
    update: {
      quantityRequired: '3',
    },
    create: {
      id: ids.recipeItems.turkeyPieFlour,
      recipeId: ids.recipe.turkeyPie,
      inventoryItemId: ids.inventory.pastryFlour,
      quantityRequired: '3',
    },
  });

  await prisma.recipeItem.upsert({
    where: {
      recipeId_inventoryItemId: {
        recipeId: ids.recipe.turkeyPie,
        inventoryItemId: ids.inventory.turkeyFilling,
      },
    },
    update: {
      quantityRequired: '5',
    },
    create: {
      id: ids.recipeItems.turkeyPieFilling,
      recipeId: ids.recipe.turkeyPie,
      inventoryItemId: ids.inventory.turkeyFilling,
      quantityRequired: '5',
    },
  });
}

async function ensureStockIns(prisma: PrismaClient) {
  await prisma.stockInRecord.updateMany({
    where: {
      id: {
        in: [ids.stockIn.flourRecord, ids.stockIn.fillingRecord],
      },
      storeId: ids.store,
    },
    data: {
      supplierId: ids.supplier,
    },
  });

  const stockInCount = await prisma.stockInRecord.count({
    where: { storeId: ids.store },
  });

  if (stockInCount > 0) {
    return;
  }

  await prisma.stockInRecord.upsert({
    where: { id: ids.stockIn.tomatoesRecord },
    update: {
      businessId: ids.business,
      storeId: ids.store,
      supplierId: ids.supplier,
      createdByUserId: ids.user,
      receivedAt: dates.tomatoesStockIn,
      externalReference: 'SUP-VAL-0001',
      notes: 'Validation baseline tomato receipt.',
    },
    create: {
      id: ids.stockIn.tomatoesRecord,
      businessId: ids.business,
      storeId: ids.store,
      supplierId: ids.supplier,
      createdByUserId: ids.user,
      receivedAt: dates.tomatoesStockIn,
      externalReference: 'SUP-VAL-0001',
      notes: 'Validation baseline tomato receipt.',
    },
  });

  await prisma.stockInItem.upsert({
    where: { id: ids.stockIn.tomatoesItem },
    update: {
      stockInRecordId: ids.stockIn.tomatoesRecord,
      inventoryItemId: ids.inventory.tomatoes,
      quantity: '60',
      unitCost: '600',
      totalCost: '36000',
    },
    create: {
      id: ids.stockIn.tomatoesItem,
      stockInRecordId: ids.stockIn.tomatoesRecord,
      inventoryItemId: ids.inventory.tomatoes,
      quantity: '60',
      unitCost: '600',
      totalCost: '36000',
    },
  });

  await prisma.stockMovement.upsert({
    where: { id: ids.stockIn.tomatoesMovement },
    update: {
      businessId: ids.business,
      storeId: ids.store,
      inventoryItemId: ids.inventory.tomatoes,
      createdByUserId: ids.user,
      movementType: StockMovementType.STOCK_IN,
      quantityChange: '60',
      occurredAt: dates.tomatoesStockIn,
      notes: 'Validation baseline tomato receipt.',
      stockInItemId: ids.stockIn.tomatoesItem,
    },
    create: {
      id: ids.stockIn.tomatoesMovement,
      businessId: ids.business,
      storeId: ids.store,
      inventoryItemId: ids.inventory.tomatoes,
      createdByUserId: ids.user,
      movementType: StockMovementType.STOCK_IN,
      quantityChange: '60',
      occurredAt: dates.tomatoesStockIn,
      notes: 'Validation baseline tomato receipt.',
      stockInItemId: ids.stockIn.tomatoesItem,
    },
  });

  await prisma.stockInRecord.upsert({
    where: { id: ids.stockIn.flourRecord },
    update: {
      businessId: ids.business,
      storeId: ids.store,
      supplierId: ids.supplier,
      createdByUserId: ids.user,
      receivedAt: dates.flourStockIn,
      externalReference: 'SUP-VAL-0002',
      notes: 'Validation baseline pastry flour receipt.',
    },
    create: {
      id: ids.stockIn.flourRecord,
      businessId: ids.business,
      storeId: ids.store,
      supplierId: ids.supplier,
      createdByUserId: ids.user,
      receivedAt: dates.flourStockIn,
      externalReference: 'SUP-VAL-0002',
      notes: 'Validation baseline pastry flour receipt.',
    },
  });

  await prisma.stockInItem.upsert({
    where: { id: ids.stockIn.flourItem },
    update: {
      stockInRecordId: ids.stockIn.flourRecord,
      inventoryItemId: ids.inventory.pastryFlour,
      quantity: '30',
      unitCost: '450',
      totalCost: '13500',
    },
    create: {
      id: ids.stockIn.flourItem,
      stockInRecordId: ids.stockIn.flourRecord,
      inventoryItemId: ids.inventory.pastryFlour,
      quantity: '30',
      unitCost: '450',
      totalCost: '13500',
    },
  });

  await prisma.stockMovement.upsert({
    where: { id: ids.stockIn.flourMovement },
    update: {
      businessId: ids.business,
      storeId: ids.store,
      inventoryItemId: ids.inventory.pastryFlour,
      createdByUserId: ids.user,
      movementType: StockMovementType.STOCK_IN,
      quantityChange: '30',
      occurredAt: dates.flourStockIn,
      notes: 'Validation baseline pastry flour receipt.',
      stockInItemId: ids.stockIn.flourItem,
    },
    create: {
      id: ids.stockIn.flourMovement,
      businessId: ids.business,
      storeId: ids.store,
      inventoryItemId: ids.inventory.pastryFlour,
      createdByUserId: ids.user,
      movementType: StockMovementType.STOCK_IN,
      quantityChange: '30',
      occurredAt: dates.flourStockIn,
      notes: 'Validation baseline pastry flour receipt.',
      stockInItemId: ids.stockIn.flourItem,
    },
  });

  await prisma.stockInRecord.upsert({
    where: { id: ids.stockIn.fillingRecord },
    update: {
      businessId: ids.business,
      storeId: ids.store,
      supplierId: ids.supplier,
      createdByUserId: ids.user,
      receivedAt: dates.fillingStockIn,
      externalReference: 'SUP-VAL-0003',
      notes: 'Validation baseline turkey filling receipt.',
    },
    create: {
      id: ids.stockIn.fillingRecord,
      businessId: ids.business,
      storeId: ids.store,
      supplierId: ids.supplier,
      createdByUserId: ids.user,
      receivedAt: dates.fillingStockIn,
      externalReference: 'SUP-VAL-0003',
      notes: 'Validation baseline turkey filling receipt.',
    },
  });

  await prisma.stockInItem.upsert({
    where: { id: ids.stockIn.fillingItem },
    update: {
      stockInRecordId: ids.stockIn.fillingRecord,
      inventoryItemId: ids.inventory.turkeyFilling,
      quantity: '50',
      unitCost: '1200',
      totalCost: '60000',
    },
    create: {
      id: ids.stockIn.fillingItem,
      stockInRecordId: ids.stockIn.fillingRecord,
      inventoryItemId: ids.inventory.turkeyFilling,
      quantity: '50',
      unitCost: '1200',
      totalCost: '60000',
    },
  });

  await prisma.stockMovement.upsert({
    where: { id: ids.stockIn.fillingMovement },
    update: {
      businessId: ids.business,
      storeId: ids.store,
      inventoryItemId: ids.inventory.turkeyFilling,
      createdByUserId: ids.user,
      movementType: StockMovementType.STOCK_IN,
      quantityChange: '50',
      occurredAt: dates.fillingStockIn,
      notes: 'Validation baseline turkey filling receipt.',
      stockInItemId: ids.stockIn.fillingItem,
    },
    create: {
      id: ids.stockIn.fillingMovement,
      businessId: ids.business,
      storeId: ids.store,
      inventoryItemId: ids.inventory.turkeyFilling,
      createdByUserId: ids.user,
      movementType: StockMovementType.STOCK_IN,
      quantityChange: '50',
      occurredAt: dates.fillingStockIn,
      notes: 'Validation baseline turkey filling receipt.',
      stockInItemId: ids.stockIn.fillingItem,
    },
  });
}

async function ensureProduction(prisma: PrismaClient) {
  const batchCount = await prisma.productionBatch.count({
    where: { storeId: ids.store },
  });

  if (batchCount === 0) {
    await prisma.productionBatch.upsert({
      where: { id: ids.production.tomatoSoupBatch },
      update: {
        businessId: ids.business,
        storeId: ids.store,
        menuItemId: ids.menu.tomatoSoup,
        recipeId: ids.recipe.tomatoSoup,
        producedInventoryItemId: ids.inventory.tomatoSoupBowl,
        createdByUserId: ids.user,
        batchNumber: 'PB-VAL-0001',
        recipeVersionUsed: 1,
        batchDate: dates.tomatoSoupBatch,
        plannedOutputQuantity: '10',
        actualOutputQuantity: '10',
        status: ProductionBatchStatus.COMPLETED,
        notes: 'Baseline tomato soup production run.',
      },
      create: {
        id: ids.production.tomatoSoupBatch,
        businessId: ids.business,
        storeId: ids.store,
        menuItemId: ids.menu.tomatoSoup,
        recipeId: ids.recipe.tomatoSoup,
        producedInventoryItemId: ids.inventory.tomatoSoupBowl,
        createdByUserId: ids.user,
        batchNumber: 'PB-VAL-0001',
        recipeVersionUsed: 1,
        batchDate: dates.tomatoSoupBatch,
        plannedOutputQuantity: '10',
        actualOutputQuantity: '10',
        status: ProductionBatchStatus.COMPLETED,
        notes: 'Baseline tomato soup production run.',
      },
    });

    await prisma.productionBatchIngredient.upsert({
      where: { id: ids.production.tomatoSoupTomatoesIngredient },
      update: {
        productionBatchId: ids.production.tomatoSoupBatch,
        inventoryItemId: ids.inventory.tomatoes,
        expectedQuantity: '20',
        actualQuantity: '20',
        varianceQuantity: '0',
      },
      create: {
        id: ids.production.tomatoSoupTomatoesIngredient,
        productionBatchId: ids.production.tomatoSoupBatch,
        inventoryItemId: ids.inventory.tomatoes,
        expectedQuantity: '20',
        actualQuantity: '20',
        varianceQuantity: '0',
      },
    });

    await prisma.stockMovement.upsert({
      where: { id: ids.production.tomatoSoupTomatoesMovement },
      update: {
        businessId: ids.business,
        storeId: ids.store,
        inventoryItemId: ids.inventory.tomatoes,
        createdByUserId: ids.user,
        movementType: StockMovementType.PRODUCTION_USE,
        quantityChange: '-20',
        occurredAt: dates.tomatoSoupBatch,
        notes: 'Tomatoes consumed for baseline tomato soup production.',
        productionBatchIngredientId: ids.production.tomatoSoupTomatoesIngredient,
      },
      create: {
        id: ids.production.tomatoSoupTomatoesMovement,
        businessId: ids.business,
        storeId: ids.store,
        inventoryItemId: ids.inventory.tomatoes,
        createdByUserId: ids.user,
        movementType: StockMovementType.PRODUCTION_USE,
        quantityChange: '-20',
        occurredAt: dates.tomatoSoupBatch,
        notes: 'Tomatoes consumed for baseline tomato soup production.',
        productionBatchIngredientId: ids.production.tomatoSoupTomatoesIngredient,
      },
    });

    await prisma.stockMovement.upsert({
      where: { id: ids.production.tomatoSoupOutputMovement },
      update: {
        businessId: ids.business,
        storeId: ids.store,
        inventoryItemId: ids.inventory.tomatoSoupBowl,
        createdByUserId: ids.user,
        movementType: StockMovementType.PRODUCTION_OUTPUT,
        quantityChange: '10',
        occurredAt: dates.tomatoSoupBatch,
        notes: 'Baseline tomato soup batch output.',
        productionBatchId: ids.production.tomatoSoupBatch,
      },
      create: {
        id: ids.production.tomatoSoupOutputMovement,
        businessId: ids.business,
        storeId: ids.store,
        inventoryItemId: ids.inventory.tomatoSoupBowl,
        createdByUserId: ids.user,
        movementType: StockMovementType.PRODUCTION_OUTPUT,
        quantityChange: '10',
        occurredAt: dates.tomatoSoupBatch,
        notes: 'Baseline tomato soup batch output.',
        productionBatchId: ids.production.tomatoSoupBatch,
      },
    });

    await prisma.productionBatch.upsert({
      where: { id: ids.production.turkeyPieBatch },
      update: {
        businessId: ids.business,
        storeId: ids.store,
        menuItemId: ids.menu.turkeyPie,
        recipeId: ids.recipe.turkeyPie,
        producedInventoryItemId: ids.inventory.turkeyPie,
        createdByUserId: ids.user,
        batchNumber: 'PB-VAL-0002',
        recipeVersionUsed: 1,
        batchDate: dates.turkeyPieBatch,
        plannedOutputQuantity: '10',
        actualOutputQuantity: '10',
        status: ProductionBatchStatus.COMPLETED,
        notes: 'Baseline turkey pie production run.',
      },
      create: {
        id: ids.production.turkeyPieBatch,
        businessId: ids.business,
        storeId: ids.store,
        menuItemId: ids.menu.turkeyPie,
        recipeId: ids.recipe.turkeyPie,
        producedInventoryItemId: ids.inventory.turkeyPie,
        createdByUserId: ids.user,
        batchNumber: 'PB-VAL-0002',
        recipeVersionUsed: 1,
        batchDate: dates.turkeyPieBatch,
        plannedOutputQuantity: '10',
        actualOutputQuantity: '10',
        status: ProductionBatchStatus.COMPLETED,
        notes: 'Baseline turkey pie production run.',
      },
    });

    await prisma.productionBatchIngredient.upsert({
      where: { id: ids.production.turkeyPieFlourIngredient },
      update: {
        productionBatchId: ids.production.turkeyPieBatch,
        inventoryItemId: ids.inventory.pastryFlour,
        expectedQuantity: '3',
        actualQuantity: '3',
        varianceQuantity: '0',
      },
      create: {
        id: ids.production.turkeyPieFlourIngredient,
        productionBatchId: ids.production.turkeyPieBatch,
        inventoryItemId: ids.inventory.pastryFlour,
        expectedQuantity: '3',
        actualQuantity: '3',
        varianceQuantity: '0',
      },
    });

    await prisma.stockMovement.upsert({
      where: { id: ids.production.turkeyPieFlourMovement },
      update: {
        businessId: ids.business,
        storeId: ids.store,
        inventoryItemId: ids.inventory.pastryFlour,
        createdByUserId: ids.user,
        movementType: StockMovementType.PRODUCTION_USE,
        quantityChange: '-3',
        occurredAt: dates.turkeyPieBatch,
        notes: 'Pastry flour consumed for baseline turkey pie production.',
        productionBatchIngredientId: ids.production.turkeyPieFlourIngredient,
      },
      create: {
        id: ids.production.turkeyPieFlourMovement,
        businessId: ids.business,
        storeId: ids.store,
        inventoryItemId: ids.inventory.pastryFlour,
        createdByUserId: ids.user,
        movementType: StockMovementType.PRODUCTION_USE,
        quantityChange: '-3',
        occurredAt: dates.turkeyPieBatch,
        notes: 'Pastry flour consumed for baseline turkey pie production.',
        productionBatchIngredientId: ids.production.turkeyPieFlourIngredient,
      },
    });
  }

  await prisma.productionBatchIngredient.upsert({
    where: { id: ids.production.turkeyPieFillingIngredient },
    update: {
      productionBatchId: ids.production.turkeyPieBatch,
      inventoryItemId: ids.inventory.turkeyFilling,
      expectedQuantity: '5',
      actualQuantity: '5',
      varianceQuantity: '0',
    },
    create: {
      id: ids.production.turkeyPieFillingIngredient,
      productionBatchId: ids.production.turkeyPieBatch,
      inventoryItemId: ids.inventory.turkeyFilling,
      expectedQuantity: '5',
      actualQuantity: '5',
      varianceQuantity: '0',
    },
  });

  await prisma.stockMovement.upsert({
    where: { id: ids.production.turkeyPieFillingMovement },
    update: {
      businessId: ids.business,
      storeId: ids.store,
      inventoryItemId: ids.inventory.turkeyFilling,
      createdByUserId: ids.user,
      movementType: StockMovementType.PRODUCTION_USE,
      quantityChange: '-5',
      occurredAt: dates.turkeyPieBatch,
      notes: 'Turkey filling consumed for baseline turkey pie production.',
      productionBatchIngredientId: ids.production.turkeyPieFillingIngredient,
    },
    create: {
      id: ids.production.turkeyPieFillingMovement,
      businessId: ids.business,
      storeId: ids.store,
      inventoryItemId: ids.inventory.turkeyFilling,
      createdByUserId: ids.user,
      movementType: StockMovementType.PRODUCTION_USE,
      quantityChange: '-5',
      occurredAt: dates.turkeyPieBatch,
      notes: 'Turkey filling consumed for baseline turkey pie production.',
      productionBatchIngredientId: ids.production.turkeyPieFillingIngredient,
    },
  });

  const turkeyPieOutputMovement = await prisma.stockMovement.findFirst({
    where: {
      productionBatchId: ids.production.turkeyPieBatch,
      movementType: StockMovementType.PRODUCTION_OUTPUT,
    },
    select: {
      id: true,
    },
  });

  if (!turkeyPieOutputMovement) {
    await prisma.stockMovement.create({
      data: {
        id: ids.production.turkeyPieOutputMovement,
        businessId: ids.business,
        storeId: ids.store,
        inventoryItemId: ids.inventory.turkeyPie,
        createdByUserId: ids.user,
        movementType: StockMovementType.PRODUCTION_OUTPUT,
        quantityChange: '10',
        occurredAt: dates.turkeyPieBatch,
        notes: 'Baseline turkey pie batch output.',
        productionBatchId: ids.production.turkeyPieBatch,
      },
    });
  }
}

async function ensureWaste(prisma: PrismaClient) {
  await prisma.wasteCategory.upsert({
    where: {
      businessId_name: {
        businessId: ids.business,
        name: 'Expired Ingredients',
      },
    },
    update: {
      description: 'Used for spoilage and short-life ingredient loss during validation.',
      deletedAt: null,
    },
    create: {
      id: ids.waste.category,
      businessId: ids.business,
      name: 'Expired Ingredients',
      description: 'Used for spoilage and short-life ingredient loss during validation.',
    },
  });

  const wasteCount = await prisma.wasteLog.count({
    where: { storeId: ids.store },
  });

  if (wasteCount > 0) {
    return;
  }

  await prisma.wasteLog.upsert({
    where: { id: ids.waste.log },
    update: {
      businessId: ids.business,
      storeId: ids.store,
      inventoryItemId: ids.inventory.tomatoes,
      wasteCategoryId: ids.waste.category,
      createdByUserId: ids.user,
      quantity: '1',
      occurredAt: dates.waste,
      note: 'A small tray of tomatoes spoiled before prep.',
      costAtLossSnapshot: '600',
    },
    create: {
      id: ids.waste.log,
      businessId: ids.business,
      storeId: ids.store,
      inventoryItemId: ids.inventory.tomatoes,
      wasteCategoryId: ids.waste.category,
      createdByUserId: ids.user,
      quantity: '1',
      occurredAt: dates.waste,
      note: 'A small tray of tomatoes spoiled before prep.',
      costAtLossSnapshot: '600',
    },
  });

  await prisma.stockMovement.upsert({
    where: { id: ids.waste.movement },
    update: {
      businessId: ids.business,
      storeId: ids.store,
      inventoryItemId: ids.inventory.tomatoes,
      createdByUserId: ids.user,
      movementType: StockMovementType.WASTE,
      quantityChange: '-1',
      occurredAt: dates.waste,
      notes: 'Expired tomatoes removed from stock.',
      wasteLogId: ids.waste.log,
    },
    create: {
      id: ids.waste.movement,
      businessId: ids.business,
      storeId: ids.store,
      inventoryItemId: ids.inventory.tomatoes,
      createdByUserId: ids.user,
      movementType: StockMovementType.WASTE,
      quantityChange: '-1',
      occurredAt: dates.waste,
      notes: 'Expired tomatoes removed from stock.',
      wasteLogId: ids.waste.log,
    },
  });
}

async function ensureSalesAndCollections(prisma: PrismaClient) {
  await prisma.salesOrder.updateMany({
    where: {
      id: {
        in: [
          '617d7be5-7993-488e-913f-bcfb4e1b7e07',
          'da8631f2-e539-4935-ab99-576e86e293db',
        ],
      },
      businessId: ids.business,
      paymentStatus: PaymentStatus.PAID,
      orderStatus: SalesOrderStatus.NEW,
    },
    data: {
      orderStatus: SalesOrderStatus.DELIVERED,
    },
  });

  const orderCount = await prisma.salesOrder.count({
    where: { storeId: ids.store },
  });

  if (orderCount === 0) {
    await prisma.salesOrder.upsert({
      where: { id: ids.sales.order },
      update: {
        businessId: ids.business,
        storeId: ids.store,
        customerId: ids.customer,
        createdByUserId: ids.user,
        orderNumber: 'SO-20260408-60150501',
        channel: SalesChannel.WHATSAPP,
        orderStatus: SalesOrderStatus.DELIVERED,
        paymentStatus: PaymentStatus.PAID,
        orderedAt: dates.order,
        subtotal: '7000',
        discount: '0',
        tax: '0',
        total: '7000',
        notes: 'Baseline customer order for the Snackit validation flow.',
      },
      create: {
        id: ids.sales.order,
        businessId: ids.business,
        storeId: ids.store,
        customerId: ids.customer,
        createdByUserId: ids.user,
        orderNumber: 'SO-20260408-60150501',
        channel: SalesChannel.WHATSAPP,
        orderStatus: SalesOrderStatus.DELIVERED,
        paymentStatus: PaymentStatus.PAID,
        orderedAt: dates.order,
        subtotal: '7000',
        discount: '0',
        tax: '0',
        total: '7000',
        notes: 'Baseline customer order for the Snackit validation flow.',
      },
    });

    await prisma.salesOrderItem.upsert({
      where: { id: ids.sales.orderItem },
      update: {
        salesOrderId: ids.sales.order,
        menuItemId: ids.menu.turkeyPie,
        fulfilledInventoryItemId: ids.inventory.turkeyPie,
        quantity: '2',
        unitPrice: '3500',
        lineTotal: '7000',
      },
      create: {
        id: ids.sales.orderItem,
        salesOrderId: ids.sales.order,
        menuItemId: ids.menu.turkeyPie,
        fulfilledInventoryItemId: ids.inventory.turkeyPie,
        quantity: '2',
        unitPrice: '3500',
        lineTotal: '7000',
      },
    });

    await prisma.stockMovement.upsert({
      where: { id: ids.sales.saleMovement },
      update: {
        businessId: ids.business,
        storeId: ids.store,
        inventoryItemId: ids.inventory.turkeyPie,
        createdByUserId: ids.user,
        movementType: StockMovementType.SALE,
        quantityChange: '-2',
        occurredAt: dates.order,
        notes: 'Baseline customer order fulfilled from finished stock.',
        salesOrderItemId: ids.sales.orderItem,
      },
      create: {
        id: ids.sales.saleMovement,
        businessId: ids.business,
        storeId: ids.store,
        inventoryItemId: ids.inventory.turkeyPie,
        createdByUserId: ids.user,
        movementType: StockMovementType.SALE,
        quantityChange: '-2',
        occurredAt: dates.order,
        notes: 'Baseline customer order fulfilled from finished stock.',
        salesOrderItemId: ids.sales.orderItem,
      },
    });

    await prisma.receipt.upsert({
      where: { id: ids.sales.receipt },
      update: {
        businessId: ids.business,
        storeId: ids.store,
        salesOrderId: ids.sales.order,
        createdByUserId: ids.user,
        receiptNumber: 'RCT-20260408-66198706',
        issuedAt: dates.receipt,
        amountPaid: '7000',
        paymentMethod: PaymentMethod.BANK_TRANSFER,
        paymentReference: 'VAL-TRF-7000',
        notes: 'Baseline payment receipt for the customer order.',
      },
      create: {
        id: ids.sales.receipt,
        businessId: ids.business,
        storeId: ids.store,
        salesOrderId: ids.sales.order,
        createdByUserId: ids.user,
        receiptNumber: 'RCT-20260408-66198706',
        issuedAt: dates.receipt,
        amountPaid: '7000',
        paymentMethod: PaymentMethod.BANK_TRANSFER,
        paymentReference: 'VAL-TRF-7000',
        notes: 'Baseline payment receipt for the customer order.',
      },
    });
  }

  const invoiceTargetOrder =
    (await prisma.salesOrder.findUnique({
      where: { id: ids.sales.order },
      select: {
        id: true,
        subtotal: true,
        discount: true,
        tax: true,
        total: true,
      },
    })) ??
    (await prisma.salesOrder.findFirst({
      where: {
        storeId: ids.store,
        receipts: {
          some: {},
        },
      },
      orderBy: {
        orderedAt: 'desc',
      },
      select: {
        id: true,
        subtotal: true,
        discount: true,
        tax: true,
        total: true,
      },
    }));

  if (invoiceTargetOrder) {
    await prisma.invoice.upsert({
      where: { salesOrderId: invoiceTargetOrder.id },
      update: {
        businessId: ids.business,
        storeId: ids.store,
        createdByUserId: ids.user,
        invoiceNumber: 'INV-20260408-70010001',
        issueDate: dates.invoiceIssue,
        dueDate: dates.invoiceDue,
        subtotal: invoiceTargetOrder.subtotal,
        discount: invoiceTargetOrder.discount,
        tax: invoiceTargetOrder.tax,
        total: invoiceTargetOrder.total,
        status: InvoiceStatus.PAID,
        notes: 'Baseline invoice anchored to the validation customer order.',
      },
      create: {
        id: ids.sales.invoice,
        businessId: ids.business,
        storeId: ids.store,
        salesOrderId: invoiceTargetOrder.id,
        createdByUserId: ids.user,
        invoiceNumber: 'INV-20260408-70010001',
        issueDate: dates.invoiceIssue,
        dueDate: dates.invoiceDue,
        subtotal: invoiceTargetOrder.subtotal,
        discount: invoiceTargetOrder.discount,
        tax: invoiceTargetOrder.tax,
        total: invoiceTargetOrder.total,
        status: InvoiceStatus.PAID,
        notes: 'Baseline invoice anchored to the validation customer order.',
      },
    });
  }
}

async function ensureFinance(prisma: PrismaClient) {
  const expenseCount = await prisma.expense.count({
    where: { storeId: ids.store },
  });

  if (expenseCount > 0) {
    return;
  }

  await prisma.expense.upsert({
    where: { id: ids.finance.expense },
    update: {
      businessId: ids.business,
      storeId: ids.store,
      supplierId: ids.supplier,
      createdByUserId: ids.user,
      category: 'Utilities',
      name: 'Kitchen gas refill',
      amount: '4500',
      incurredAt: dates.expense,
      notes: 'Baseline operating expense tied to the validation week.',
    },
    create: {
      id: ids.finance.expense,
      businessId: ids.business,
      storeId: ids.store,
      supplierId: ids.supplier,
      createdByUserId: ids.user,
      category: 'Utilities',
      name: 'Kitchen gas refill',
      amount: '4500',
      incurredAt: dates.expense,
      notes: 'Baseline operating expense tied to the validation week.',
    },
  });
}

async function ensureReconciliation(prisma: PrismaClient) {
  const reconciliationCount = await prisma.inventoryReconciliation.count({
    where: { storeId: ids.store },
  });

  if (reconciliationCount > 0) {
    return;
  }

  await prisma.inventoryReconciliation.upsert({
    where: { id: ids.reconciliation.session },
    update: {
      businessId: ids.business,
      storeId: ids.store,
      createdByUserId: ids.user,
      status: ReconciliationStatus.POSTED,
      startedAt: dates.reconciliationStart,
      postedAt: dates.reconciliationPosted,
      notes: 'Baseline posted reconciliation showing one controlled finished-good correction.',
    },
    create: {
      id: ids.reconciliation.session,
      businessId: ids.business,
      storeId: ids.store,
      createdByUserId: ids.user,
      status: ReconciliationStatus.POSTED,
      startedAt: dates.reconciliationStart,
      postedAt: dates.reconciliationPosted,
      notes: 'Baseline posted reconciliation showing one controlled finished-good correction.',
    },
  });

  await prisma.reconciliationItem.upsert({
    where: { id: ids.reconciliation.item },
    update: {
      inventoryReconciliationId: ids.reconciliation.session,
      inventoryItemId: ids.inventory.turkeyPie,
      expectedQuantity: '8',
      actualQuantity: '7',
      varianceQuantity: '-1',
    },
    create: {
      id: ids.reconciliation.item,
      inventoryReconciliationId: ids.reconciliation.session,
      inventoryItemId: ids.inventory.turkeyPie,
      expectedQuantity: '8',
      actualQuantity: '7',
      varianceQuantity: '-1',
    },
  });

  await prisma.stockMovement.upsert({
    where: { id: ids.reconciliation.movement },
    update: {
      businessId: ids.business,
      storeId: ids.store,
      inventoryItemId: ids.inventory.turkeyPie,
      createdByUserId: ids.user,
      movementType: StockMovementType.INVENTORY_ADJUSTMENT,
      quantityChange: '-1',
      occurredAt: dates.reconciliationPosted,
      notes: 'Baseline reconciliation adjustment for the finished-good count.',
      reconciliationItemId: ids.reconciliation.item,
    },
    create: {
      id: ids.reconciliation.movement,
      businessId: ids.business,
      storeId: ids.store,
      inventoryItemId: ids.inventory.turkeyPie,
      createdByUserId: ids.user,
      movementType: StockMovementType.INVENTORY_ADJUSTMENT,
      quantityChange: '-1',
      occurredAt: dates.reconciliationPosted,
      notes: 'Baseline reconciliation adjustment for the finished-good count.',
      reconciliationItemId: ids.reconciliation.item,
    },
  });
}

async function ensureFashionValidationIdentity(prisma: PrismaClient) {
  const business = await prisma.business.upsert({
    where: { id: fashionIds.business },
    update: {
      name: 'Perfect Fabric Workspace',
      currencyCode: 'NGN',
      timezone: 'Africa/Lagos',
      deletedAt: null,
    },
    create: {
      id: fashionIds.business,
      name: 'Perfect Fabric Workspace',
      currencyCode: 'NGN',
      timezone: 'Africa/Lagos',
    },
  });

  const role = await prisma.role.upsert({
    where: {
      businessId_name: {
        businessId: fashionIds.business,
        name: 'admin',
      },
    },
    update: {
      description: 'Administrator role for fashion validation access',
      isSystemRole: true,
      deletedAt: null,
    },
    create: {
      id: fashionIds.role,
      businessId: fashionIds.business,
      name: 'admin',
      description: 'Administrator role for fashion validation access',
      isSystemRole: true,
    },
  });

  const store = await prisma.store.upsert({
    where: { id: fashionIds.store },
    update: {
      businessId: fashionIds.business,
      name: 'Perfect Fabric Main Studio',
      storeType: StoreType.PHYSICAL,
      address: '18B Acme Road, Ikeja, Lagos',
      isActive: true,
      deletedAt: null,
    },
    create: {
      id: fashionIds.store,
      businessId: fashionIds.business,
      name: 'Perfect Fabric Main Studio',
      storeType: StoreType.PHYSICAL,
      address: '18B Acme Road, Ikeja, Lagos',
    },
  });

  const user = await prisma.user.upsert({
    where: { id: fashionIds.user },
    update: {
      businessId: fashionIds.business,
      roleId: role.id,
      primaryStoreId: store.id,
      fullName: 'Perfect Fabric Validation User',
      email: fashionValidationUserEmail,
      isActive: true,
      deletedAt: null,
    },
    create: {
      id: fashionIds.user,
      businessId: fashionIds.business,
      roleId: role.id,
      primaryStoreId: store.id,
      fullName: 'Perfect Fabric Validation User',
      email: fashionValidationUserEmail,
    },
  });

  await prisma.store.updateMany({
    where: {
      businessId: fashionIds.business,
      id: {
        not: fashionIds.store,
      },
      deletedAt: null,
      isActive: true,
    },
    data: {
      isActive: false,
    },
  });

  return { business, role, store, user };
}

async function ensureFashionEntities(prisma: PrismaClient) {
  const supplier = await prisma.supplier.upsert({
    where: { id: fashionIds.supplier },
    update: {
      businessId: fashionIds.business,
      name: 'Loom & Trim Supply Co.',
      contactName: 'Bisi Adebayo',
      phone: '08020001122',
      email: 'bisi@loomtrim.co',
      address: '57 Industrial Estate Road, Lagos',
      notes: 'Core materials and trims partner for the ready-to-wear validation flow.',
      deletedAt: null,
    },
    create: {
      id: fashionIds.supplier,
      businessId: fashionIds.business,
      name: 'Loom & Trim Supply Co.',
      contactName: 'Bisi Adebayo',
      phone: '08020001122',
      email: 'bisi@loomtrim.co',
      address: '57 Industrial Estate Road, Lagos',
      notes: 'Core materials and trims partner for the ready-to-wear validation flow.',
    },
  });

  const customer = await prisma.customer.upsert({
    where: { id: fashionIds.customer },
    update: {
      businessId: fashionIds.business,
      name: 'Muna Retail Studio',
      phone: '08034560090',
      email: 'orders@munaretail.ng',
      address: 'Lekki, Lagos',
      notes: 'Validation customer used for first fashion order, invoice, and receipt review.',
      isActive: true,
      deletedAt: null,
    },
    create: {
      id: fashionIds.customer,
      businessId: fashionIds.business,
      name: 'Muna Retail Studio',
      phone: '08034560090',
      email: 'orders@munaretail.ng',
      address: 'Lekki, Lagos',
      notes: 'Validation customer used for first fashion order, invoice, and receipt review.',
    },
  });

  return { supplier, customer };
}

async function ensureFashionCatalog(prisma: PrismaClient) {
  await prisma.inventoryItem.upsert({
    where: { id: fashionIds.inventory.cottonTwill },
    update: {
      businessId: fashionIds.business,
      name: 'Cotton Twill',
      itemType: InventoryItemType.RAW_MATERIAL,
      unitOfMeasure: 'm',
      defaultCostPerUnit: '2800',
      restockPoint: '30',
      isActive: true,
      trackExpiry: false,
      deletedAt: null,
    },
    create: {
      id: fashionIds.inventory.cottonTwill,
      businessId: fashionIds.business,
      name: 'Cotton Twill',
      itemType: InventoryItemType.RAW_MATERIAL,
      unitOfMeasure: 'm',
      defaultCostPerUnit: '2800',
      restockPoint: '30',
    },
  });

  await prisma.inventoryItem.upsert({
    where: { id: fashionIds.inventory.satinLining },
    update: {
      businessId: fashionIds.business,
      name: 'Satin Lining',
      itemType: InventoryItemType.RAW_MATERIAL,
      unitOfMeasure: 'm',
      defaultCostPerUnit: '1800',
      restockPoint: '20',
      isActive: true,
      trackExpiry: false,
      deletedAt: null,
    },
    create: {
      id: fashionIds.inventory.satinLining,
      businessId: fashionIds.business,
      name: 'Satin Lining',
      itemType: InventoryItemType.RAW_MATERIAL,
      unitOfMeasure: 'm',
      defaultCostPerUnit: '1800',
      restockPoint: '20',
    },
  });

  await prisma.inventoryItem.upsert({
    where: { id: fashionIds.inventory.metalZip },
    update: {
      businessId: fashionIds.business,
      name: 'Metal Zip',
      itemType: InventoryItemType.PACKAGING,
      unitOfMeasure: 'pcs',
      defaultCostPerUnit: '650',
      restockPoint: '40',
      isActive: true,
      trackExpiry: false,
      deletedAt: null,
    },
    create: {
      id: fashionIds.inventory.metalZip,
      businessId: fashionIds.business,
      name: 'Metal Zip',
      itemType: InventoryItemType.PACKAGING,
      unitOfMeasure: 'pcs',
      defaultCostPerUnit: '650',
      restockPoint: '40',
    },
  });

  await prisma.inventoryItem.upsert({
    where: { id: fashionIds.inventory.utilityJacketUnit },
    update: {
      businessId: fashionIds.business,
      name: 'Utility Jacket Unit',
      itemType: InventoryItemType.FINISHED_GOOD,
      unitOfMeasure: 'pcs',
      defaultCostPerUnit: '16000',
      defaultSellingPrice: '32000',
      restockPoint: '8',
      isActive: true,
      deletedAt: null,
    },
    create: {
      id: fashionIds.inventory.utilityJacketUnit,
      businessId: fashionIds.business,
      name: 'Utility Jacket Unit',
      itemType: InventoryItemType.FINISHED_GOOD,
      unitOfMeasure: 'pcs',
      defaultCostPerUnit: '16000',
      defaultSellingPrice: '32000',
      restockPoint: '8',
    },
  });

  await prisma.menuItem.upsert({
    where: { id: fashionIds.menu.utilityJacket },
    update: {
      businessId: fashionIds.business,
      name: 'Utility Jacket',
      defaultPrice: '32000',
      isActive: true,
      deletedAt: null,
    },
    create: {
      id: fashionIds.menu.utilityJacket,
      businessId: fashionIds.business,
      name: 'Utility Jacket',
      defaultPrice: '32000',
    },
  });

  await prisma.recipe.upsert({
    where: { id: fashionIds.recipe.utilityJacket },
    update: {
      businessId: fashionIds.business,
      menuItemId: fashionIds.menu.utilityJacket,
      producedInventoryItemId: fashionIds.inventory.utilityJacketUnit,
      version: 1,
      yieldQuantity: '12',
      isActive: true,
      instructions:
        'Cut shell panels, attach satin lining, install zips, finish twelve utility jacket units, and complete final quality check.',
      deletedAt: null,
    },
    create: {
      id: fashionIds.recipe.utilityJacket,
      businessId: fashionIds.business,
      menuItemId: fashionIds.menu.utilityJacket,
      producedInventoryItemId: fashionIds.inventory.utilityJacketUnit,
      version: 1,
      yieldQuantity: '12',
      instructions:
        'Cut shell panels, attach satin lining, install zips, finish twelve utility jacket units, and complete final quality check.',
    },
  });

  await prisma.recipeItem.upsert({
    where: {
      recipeId_inventoryItemId: {
        recipeId: fashionIds.recipe.utilityJacket,
        inventoryItemId: fashionIds.inventory.cottonTwill,
      },
    },
    update: {
      quantityRequired: '18',
    },
    create: {
      id: fashionIds.recipeItems.jacketTwill,
      recipeId: fashionIds.recipe.utilityJacket,
      inventoryItemId: fashionIds.inventory.cottonTwill,
      quantityRequired: '18',
    },
  });

  await prisma.recipeItem.upsert({
    where: {
      recipeId_inventoryItemId: {
        recipeId: fashionIds.recipe.utilityJacket,
        inventoryItemId: fashionIds.inventory.satinLining,
      },
    },
    update: {
      quantityRequired: '12',
    },
    create: {
      id: fashionIds.recipeItems.jacketLining,
      recipeId: fashionIds.recipe.utilityJacket,
      inventoryItemId: fashionIds.inventory.satinLining,
      quantityRequired: '12',
    },
  });

  await prisma.recipeItem.upsert({
    where: {
      recipeId_inventoryItemId: {
        recipeId: fashionIds.recipe.utilityJacket,
        inventoryItemId: fashionIds.inventory.metalZip,
      },
    },
    update: {
      quantityRequired: '12',
    },
    create: {
      id: fashionIds.recipeItems.jacketZip,
      recipeId: fashionIds.recipe.utilityJacket,
      inventoryItemId: fashionIds.inventory.metalZip,
      quantityRequired: '12',
    },
  });
}

async function ensureFashionStockIns(prisma: PrismaClient) {
  await prisma.stockInRecord.upsert({
    where: { id: fashionIds.stockIn.twillRecord },
    update: {
      businessId: fashionIds.business,
      storeId: fashionIds.store,
      supplierId: fashionIds.supplier,
      createdByUserId: fashionIds.user,
      receivedAt: fashionDates.twillStockIn,
      externalReference: 'AST-MAT-0001',
      notes: 'Baseline cotton twill receipt for fashion validation.',
    },
    create: {
      id: fashionIds.stockIn.twillRecord,
      businessId: fashionIds.business,
      storeId: fashionIds.store,
      supplierId: fashionIds.supplier,
      createdByUserId: fashionIds.user,
      receivedAt: fashionDates.twillStockIn,
      externalReference: 'AST-MAT-0001',
      notes: 'Baseline cotton twill receipt for fashion validation.',
    },
  });

  await prisma.stockInItem.upsert({
    where: { id: fashionIds.stockIn.twillItem },
    update: {
      stockInRecordId: fashionIds.stockIn.twillRecord,
      inventoryItemId: fashionIds.inventory.cottonTwill,
      quantity: '80',
      unitCost: '2800',
      totalCost: '224000',
    },
    create: {
      id: fashionIds.stockIn.twillItem,
      stockInRecordId: fashionIds.stockIn.twillRecord,
      inventoryItemId: fashionIds.inventory.cottonTwill,
      quantity: '80',
      unitCost: '2800',
      totalCost: '224000',
    },
  });

  await prisma.stockMovement.upsert({
    where: { id: fashionIds.stockIn.twillMovement },
    update: {
      businessId: fashionIds.business,
      storeId: fashionIds.store,
      inventoryItemId: fashionIds.inventory.cottonTwill,
      createdByUserId: fashionIds.user,
      movementType: StockMovementType.STOCK_IN,
      quantityChange: '80',
      occurredAt: fashionDates.twillStockIn,
      notes: 'Baseline cotton twill receipt.',
      stockInItemId: fashionIds.stockIn.twillItem,
    },
    create: {
      id: fashionIds.stockIn.twillMovement,
      businessId: fashionIds.business,
      storeId: fashionIds.store,
      inventoryItemId: fashionIds.inventory.cottonTwill,
      createdByUserId: fashionIds.user,
      movementType: StockMovementType.STOCK_IN,
      quantityChange: '80',
      occurredAt: fashionDates.twillStockIn,
      notes: 'Baseline cotton twill receipt.',
      stockInItemId: fashionIds.stockIn.twillItem,
    },
  });

  await prisma.stockInRecord.upsert({
    where: { id: fashionIds.stockIn.liningRecord },
    update: {
      businessId: fashionIds.business,
      storeId: fashionIds.store,
      supplierId: fashionIds.supplier,
      createdByUserId: fashionIds.user,
      receivedAt: fashionDates.liningStockIn,
      externalReference: 'AST-MAT-0002',
      notes: 'Baseline satin lining receipt for fashion validation.',
    },
    create: {
      id: fashionIds.stockIn.liningRecord,
      businessId: fashionIds.business,
      storeId: fashionIds.store,
      supplierId: fashionIds.supplier,
      createdByUserId: fashionIds.user,
      receivedAt: fashionDates.liningStockIn,
      externalReference: 'AST-MAT-0002',
      notes: 'Baseline satin lining receipt for fashion validation.',
    },
  });

  await prisma.stockInItem.upsert({
    where: { id: fashionIds.stockIn.liningItem },
    update: {
      stockInRecordId: fashionIds.stockIn.liningRecord,
      inventoryItemId: fashionIds.inventory.satinLining,
      quantity: '50',
      unitCost: '1800',
      totalCost: '90000',
    },
    create: {
      id: fashionIds.stockIn.liningItem,
      stockInRecordId: fashionIds.stockIn.liningRecord,
      inventoryItemId: fashionIds.inventory.satinLining,
      quantity: '50',
      unitCost: '1800',
      totalCost: '90000',
    },
  });

  await prisma.stockMovement.upsert({
    where: { id: fashionIds.stockIn.liningMovement },
    update: {
      businessId: fashionIds.business,
      storeId: fashionIds.store,
      inventoryItemId: fashionIds.inventory.satinLining,
      createdByUserId: fashionIds.user,
      movementType: StockMovementType.STOCK_IN,
      quantityChange: '50',
      occurredAt: fashionDates.liningStockIn,
      notes: 'Baseline satin lining receipt.',
      stockInItemId: fashionIds.stockIn.liningItem,
    },
    create: {
      id: fashionIds.stockIn.liningMovement,
      businessId: fashionIds.business,
      storeId: fashionIds.store,
      inventoryItemId: fashionIds.inventory.satinLining,
      createdByUserId: fashionIds.user,
      movementType: StockMovementType.STOCK_IN,
      quantityChange: '50',
      occurredAt: fashionDates.liningStockIn,
      notes: 'Baseline satin lining receipt.',
      stockInItemId: fashionIds.stockIn.liningItem,
    },
  });

  await prisma.stockInRecord.upsert({
    where: { id: fashionIds.stockIn.zipRecord },
    update: {
      businessId: fashionIds.business,
      storeId: fashionIds.store,
      supplierId: fashionIds.supplier,
      createdByUserId: fashionIds.user,
      receivedAt: fashionDates.zipStockIn,
      externalReference: 'AST-MAT-0003',
      notes: 'Baseline zip receipt for fashion validation.',
    },
    create: {
      id: fashionIds.stockIn.zipRecord,
      businessId: fashionIds.business,
      storeId: fashionIds.store,
      supplierId: fashionIds.supplier,
      createdByUserId: fashionIds.user,
      receivedAt: fashionDates.zipStockIn,
      externalReference: 'AST-MAT-0003',
      notes: 'Baseline zip receipt for fashion validation.',
    },
  });

  await prisma.stockInItem.upsert({
    where: { id: fashionIds.stockIn.zipItem },
    update: {
      stockInRecordId: fashionIds.stockIn.zipRecord,
      inventoryItemId: fashionIds.inventory.metalZip,
      quantity: '60',
      unitCost: '650',
      totalCost: '39000',
    },
    create: {
      id: fashionIds.stockIn.zipItem,
      stockInRecordId: fashionIds.stockIn.zipRecord,
      inventoryItemId: fashionIds.inventory.metalZip,
      quantity: '60',
      unitCost: '650',
      totalCost: '39000',
    },
  });

  await prisma.stockMovement.upsert({
    where: { id: fashionIds.stockIn.zipMovement },
    update: {
      businessId: fashionIds.business,
      storeId: fashionIds.store,
      inventoryItemId: fashionIds.inventory.metalZip,
      createdByUserId: fashionIds.user,
      movementType: StockMovementType.STOCK_IN,
      quantityChange: '60',
      occurredAt: fashionDates.zipStockIn,
      notes: 'Baseline zip receipt.',
      stockInItemId: fashionIds.stockIn.zipItem,
    },
    create: {
      id: fashionIds.stockIn.zipMovement,
      businessId: fashionIds.business,
      storeId: fashionIds.store,
      inventoryItemId: fashionIds.inventory.metalZip,
      createdByUserId: fashionIds.user,
      movementType: StockMovementType.STOCK_IN,
      quantityChange: '60',
      occurredAt: fashionDates.zipStockIn,
      notes: 'Baseline zip receipt.',
      stockInItemId: fashionIds.stockIn.zipItem,
    },
  });
}

async function ensureFashionProduction(prisma: PrismaClient) {
  await prisma.productionBatch.upsert({
    where: { id: fashionIds.production.jacketBatch },
    update: {
      businessId: fashionIds.business,
      storeId: fashionIds.store,
      menuItemId: fashionIds.menu.utilityJacket,
      recipeId: fashionIds.recipe.utilityJacket,
      producedInventoryItemId: fashionIds.inventory.utilityJacketUnit,
      createdByUserId: fashionIds.user,
      batchNumber: 'WO-20260405-0001',
      recipeVersionUsed: 1,
      batchDate: fashionDates.jacketBatch,
      plannedOutputQuantity: '12',
      actualOutputQuantity: '12',
      status: ProductionBatchStatus.COMPLETED,
      notes: 'Baseline utility jacket work order for fashion validation.',
    },
    create: {
      id: fashionIds.production.jacketBatch,
      businessId: fashionIds.business,
      storeId: fashionIds.store,
      menuItemId: fashionIds.menu.utilityJacket,
      recipeId: fashionIds.recipe.utilityJacket,
      producedInventoryItemId: fashionIds.inventory.utilityJacketUnit,
      createdByUserId: fashionIds.user,
      batchNumber: 'WO-20260405-0001',
      recipeVersionUsed: 1,
      batchDate: fashionDates.jacketBatch,
      plannedOutputQuantity: '12',
      actualOutputQuantity: '12',
      status: ProductionBatchStatus.COMPLETED,
      notes: 'Baseline utility jacket work order for fashion validation.',
    },
  });

  await prisma.productionBatchIngredient.upsert({
    where: { id: fashionIds.production.jacketTwillIngredient },
    update: {
      productionBatchId: fashionIds.production.jacketBatch,
      inventoryItemId: fashionIds.inventory.cottonTwill,
      expectedQuantity: '18',
      actualQuantity: '18',
      varianceQuantity: '0',
    },
    create: {
      id: fashionIds.production.jacketTwillIngredient,
      productionBatchId: fashionIds.production.jacketBatch,
      inventoryItemId: fashionIds.inventory.cottonTwill,
      expectedQuantity: '18',
      actualQuantity: '18',
      varianceQuantity: '0',
    },
  });

  await prisma.stockMovement.upsert({
    where: { id: fashionIds.production.jacketTwillMovement },
    update: {
      businessId: fashionIds.business,
      storeId: fashionIds.store,
      inventoryItemId: fashionIds.inventory.cottonTwill,
      createdByUserId: fashionIds.user,
      movementType: StockMovementType.PRODUCTION_USE,
      quantityChange: '-18',
      occurredAt: fashionDates.jacketBatch,
      notes: 'Cotton twill consumed for utility jacket work order.',
      productionBatchIngredientId: fashionIds.production.jacketTwillIngredient,
    },
    create: {
      id: fashionIds.production.jacketTwillMovement,
      businessId: fashionIds.business,
      storeId: fashionIds.store,
      inventoryItemId: fashionIds.inventory.cottonTwill,
      createdByUserId: fashionIds.user,
      movementType: StockMovementType.PRODUCTION_USE,
      quantityChange: '-18',
      occurredAt: fashionDates.jacketBatch,
      notes: 'Cotton twill consumed for utility jacket work order.',
      productionBatchIngredientId: fashionIds.production.jacketTwillIngredient,
    },
  });

  await prisma.productionBatchIngredient.upsert({
    where: { id: fashionIds.production.jacketLiningIngredient },
    update: {
      productionBatchId: fashionIds.production.jacketBatch,
      inventoryItemId: fashionIds.inventory.satinLining,
      expectedQuantity: '12',
      actualQuantity: '12',
      varianceQuantity: '0',
    },
    create: {
      id: fashionIds.production.jacketLiningIngredient,
      productionBatchId: fashionIds.production.jacketBatch,
      inventoryItemId: fashionIds.inventory.satinLining,
      expectedQuantity: '12',
      actualQuantity: '12',
      varianceQuantity: '0',
    },
  });

  await prisma.stockMovement.upsert({
    where: { id: fashionIds.production.jacketLiningMovement },
    update: {
      businessId: fashionIds.business,
      storeId: fashionIds.store,
      inventoryItemId: fashionIds.inventory.satinLining,
      createdByUserId: fashionIds.user,
      movementType: StockMovementType.PRODUCTION_USE,
      quantityChange: '-12',
      occurredAt: fashionDates.jacketBatch,
      notes: 'Satin lining consumed for utility jacket work order.',
      productionBatchIngredientId: fashionIds.production.jacketLiningIngredient,
    },
    create: {
      id: fashionIds.production.jacketLiningMovement,
      businessId: fashionIds.business,
      storeId: fashionIds.store,
      inventoryItemId: fashionIds.inventory.satinLining,
      createdByUserId: fashionIds.user,
      movementType: StockMovementType.PRODUCTION_USE,
      quantityChange: '-12',
      occurredAt: fashionDates.jacketBatch,
      notes: 'Satin lining consumed for utility jacket work order.',
      productionBatchIngredientId: fashionIds.production.jacketLiningIngredient,
    },
  });

  await prisma.productionBatchIngredient.upsert({
    where: { id: fashionIds.production.jacketZipIngredient },
    update: {
      productionBatchId: fashionIds.production.jacketBatch,
      inventoryItemId: fashionIds.inventory.metalZip,
      expectedQuantity: '12',
      actualQuantity: '12',
      varianceQuantity: '0',
    },
    create: {
      id: fashionIds.production.jacketZipIngredient,
      productionBatchId: fashionIds.production.jacketBatch,
      inventoryItemId: fashionIds.inventory.metalZip,
      expectedQuantity: '12',
      actualQuantity: '12',
      varianceQuantity: '0',
    },
  });

  await prisma.stockMovement.upsert({
    where: { id: fashionIds.production.jacketZipMovement },
    update: {
      businessId: fashionIds.business,
      storeId: fashionIds.store,
      inventoryItemId: fashionIds.inventory.metalZip,
      createdByUserId: fashionIds.user,
      movementType: StockMovementType.PRODUCTION_USE,
      quantityChange: '-12',
      occurredAt: fashionDates.jacketBatch,
      notes: 'Zips consumed for utility jacket work order.',
      productionBatchIngredientId: fashionIds.production.jacketZipIngredient,
    },
    create: {
      id: fashionIds.production.jacketZipMovement,
      businessId: fashionIds.business,
      storeId: fashionIds.store,
      inventoryItemId: fashionIds.inventory.metalZip,
      createdByUserId: fashionIds.user,
      movementType: StockMovementType.PRODUCTION_USE,
      quantityChange: '-12',
      occurredAt: fashionDates.jacketBatch,
      notes: 'Zips consumed for utility jacket work order.',
      productionBatchIngredientId: fashionIds.production.jacketZipIngredient,
    },
  });

  await prisma.stockMovement.upsert({
    where: { id: fashionIds.production.jacketOutputMovement },
    update: {
      businessId: fashionIds.business,
      storeId: fashionIds.store,
      inventoryItemId: fashionIds.inventory.utilityJacketUnit,
      createdByUserId: fashionIds.user,
      movementType: StockMovementType.PRODUCTION_OUTPUT,
      quantityChange: '12',
      occurredAt: fashionDates.jacketBatch,
      notes: 'Finished utility jacket units posted from baseline work order.',
      productionBatchId: fashionIds.production.jacketBatch,
    },
    create: {
      id: fashionIds.production.jacketOutputMovement,
      businessId: fashionIds.business,
      storeId: fashionIds.store,
      inventoryItemId: fashionIds.inventory.utilityJacketUnit,
      createdByUserId: fashionIds.user,
      movementType: StockMovementType.PRODUCTION_OUTPUT,
      quantityChange: '12',
      occurredAt: fashionDates.jacketBatch,
      notes: 'Finished utility jacket units posted from baseline work order.',
      productionBatchId: fashionIds.production.jacketBatch,
    },
  });
}

async function ensureFashionWaste(prisma: PrismaClient) {
  await prisma.wasteCategory.upsert({
    where: {
      businessId_name: {
        businessId: fashionIds.business,
        name: 'QC Defect',
      },
    },
    update: {
      description: 'Used when a finished unit fails inspection before dispatch.',
      deletedAt: null,
    },
    create: {
      id: fashionIds.waste.category,
      businessId: fashionIds.business,
      name: 'QC Defect',
      description: 'Used when a finished unit fails inspection before dispatch.',
    },
  });

  await prisma.wasteLog.upsert({
    where: { id: fashionIds.waste.log },
    update: {
      businessId: fashionIds.business,
      storeId: fashionIds.store,
      inventoryItemId: fashionIds.inventory.utilityJacketUnit,
      wasteCategoryId: fashionIds.waste.category,
      createdByUserId: fashionIds.user,
      quantity: '1',
      occurredAt: fashionDates.waste,
      note: 'One utility jacket failed final QC because of a broken sleeve seam.',
      costAtLossSnapshot: '16000',
    },
    create: {
      id: fashionIds.waste.log,
      businessId: fashionIds.business,
      storeId: fashionIds.store,
      inventoryItemId: fashionIds.inventory.utilityJacketUnit,
      wasteCategoryId: fashionIds.waste.category,
      createdByUserId: fashionIds.user,
      quantity: '1',
      occurredAt: fashionDates.waste,
      note: 'One utility jacket failed final QC because of a broken sleeve seam.',
      costAtLossSnapshot: '16000',
    },
  });

  await prisma.stockMovement.upsert({
    where: { id: fashionIds.waste.movement },
    update: {
      businessId: fashionIds.business,
      storeId: fashionIds.store,
      inventoryItemId: fashionIds.inventory.utilityJacketUnit,
      createdByUserId: fashionIds.user,
      movementType: StockMovementType.WASTE,
      quantityChange: '-1',
      occurredAt: fashionDates.waste,
      notes: 'QC defect removed from finished SKU stock.',
      wasteLogId: fashionIds.waste.log,
    },
    create: {
      id: fashionIds.waste.movement,
      businessId: fashionIds.business,
      storeId: fashionIds.store,
      inventoryItemId: fashionIds.inventory.utilityJacketUnit,
      createdByUserId: fashionIds.user,
      movementType: StockMovementType.WASTE,
      quantityChange: '-1',
      occurredAt: fashionDates.waste,
      notes: 'QC defect removed from finished SKU stock.',
      wasteLogId: fashionIds.waste.log,
    },
  });
}

async function ensureFashionSalesAndCollections(prisma: PrismaClient) {
  await prisma.salesOrder.upsert({
    where: { id: fashionIds.sales.order },
    update: {
      businessId: fashionIds.business,
      storeId: fashionIds.store,
      customerId: fashionIds.customer,
      createdByUserId: fashionIds.user,
      orderNumber: 'SO-20260407-RTW-0001',
      channel: SalesChannel.INSTAGRAM,
      orderStatus: SalesOrderStatus.DELIVERED,
      paymentStatus: PaymentStatus.PARTIALLY_PAID,
      orderedAt: fashionDates.order,
      subtotal: '128000',
      discount: '0',
      tax: '0',
      total: '128000',
      notes: 'Baseline ready-to-wear order for fashion validation.',
    },
    create: {
      id: fashionIds.sales.order,
      businessId: fashionIds.business,
      storeId: fashionIds.store,
      customerId: fashionIds.customer,
      createdByUserId: fashionIds.user,
      orderNumber: 'SO-20260407-RTW-0001',
      channel: SalesChannel.INSTAGRAM,
      orderStatus: SalesOrderStatus.DELIVERED,
      paymentStatus: PaymentStatus.PARTIALLY_PAID,
      orderedAt: fashionDates.order,
      subtotal: '128000',
      discount: '0',
      tax: '0',
      total: '128000',
      notes: 'Baseline ready-to-wear order for fashion validation.',
    },
  });

  await prisma.salesOrderItem.upsert({
    where: { id: fashionIds.sales.orderItem },
    update: {
      salesOrderId: fashionIds.sales.order,
      menuItemId: fashionIds.menu.utilityJacket,
      fulfilledInventoryItemId: fashionIds.inventory.utilityJacketUnit,
      quantity: '4',
      unitPrice: '32000',
      lineTotal: '128000',
    },
    create: {
      id: fashionIds.sales.orderItem,
      salesOrderId: fashionIds.sales.order,
      menuItemId: fashionIds.menu.utilityJacket,
      fulfilledInventoryItemId: fashionIds.inventory.utilityJacketUnit,
      quantity: '4',
      unitPrice: '32000',
      lineTotal: '128000',
    },
  });

  await prisma.stockMovement.upsert({
    where: { id: fashionIds.sales.saleMovement },
    update: {
      businessId: fashionIds.business,
      storeId: fashionIds.store,
      inventoryItemId: fashionIds.inventory.utilityJacketUnit,
      createdByUserId: fashionIds.user,
      movementType: StockMovementType.SALE,
      quantityChange: '-4',
      occurredAt: fashionDates.order,
      notes: 'Finished utility jackets fulfilled for the baseline fashion order.',
      salesOrderItemId: fashionIds.sales.orderItem,
    },
    create: {
      id: fashionIds.sales.saleMovement,
      businessId: fashionIds.business,
      storeId: fashionIds.store,
      inventoryItemId: fashionIds.inventory.utilityJacketUnit,
      createdByUserId: fashionIds.user,
      movementType: StockMovementType.SALE,
      quantityChange: '-4',
      occurredAt: fashionDates.order,
      notes: 'Finished utility jackets fulfilled for the baseline fashion order.',
      salesOrderItemId: fashionIds.sales.orderItem,
    },
  });

  await prisma.receipt.upsert({
    where: { id: fashionIds.sales.receipt },
    update: {
      businessId: fashionIds.business,
      storeId: fashionIds.store,
      salesOrderId: fashionIds.sales.order,
      createdByUserId: fashionIds.user,
      receiptNumber: 'RCT-20260408-RTW-0001',
      issuedAt: fashionDates.receipt,
      amountPaid: '64000',
      paymentMethod: PaymentMethod.BANK_TRANSFER,
      paymentReference: 'AST-VAL-64000',
      notes: 'Partial payment receipt for the baseline fashion order.',
    },
    create: {
      id: fashionIds.sales.receipt,
      businessId: fashionIds.business,
      storeId: fashionIds.store,
      salesOrderId: fashionIds.sales.order,
      createdByUserId: fashionIds.user,
      receiptNumber: 'RCT-20260408-RTW-0001',
      issuedAt: fashionDates.receipt,
      amountPaid: '64000',
      paymentMethod: PaymentMethod.BANK_TRANSFER,
      paymentReference: 'AST-VAL-64000',
      notes: 'Partial payment receipt for the baseline fashion order.',
    },
  });

  await prisma.invoice.upsert({
    where: { salesOrderId: fashionIds.sales.order },
    update: {
      businessId: fashionIds.business,
      storeId: fashionIds.store,
      createdByUserId: fashionIds.user,
      invoiceNumber: 'INV-20260407-RTW-0001',
      issueDate: fashionDates.invoiceIssue,
      dueDate: fashionDates.invoiceDue,
      subtotal: '128000',
      discount: '0',
      tax: '0',
      total: '128000',
      status: InvoiceStatus.PARTIALLY_PAID,
      notes: 'Baseline invoice anchored to the fashion validation order.',
    },
    create: {
      id: fashionIds.sales.invoice,
      businessId: fashionIds.business,
      storeId: fashionIds.store,
      salesOrderId: fashionIds.sales.order,
      createdByUserId: fashionIds.user,
      invoiceNumber: 'INV-20260407-RTW-0001',
      issueDate: fashionDates.invoiceIssue,
      dueDate: fashionDates.invoiceDue,
      subtotal: '128000',
      discount: '0',
      tax: '0',
      total: '128000',
      status: InvoiceStatus.PARTIALLY_PAID,
      notes: 'Baseline invoice anchored to the fashion validation order.',
    },
  });
}

async function ensureFashionFinance(prisma: PrismaClient) {
  await prisma.expense.upsert({
    where: { id: fashionIds.finance.expense },
    update: {
      businessId: fashionIds.business,
      storeId: fashionIds.store,
      supplierId: fashionIds.supplier,
      createdByUserId: fashionIds.user,
      category: 'Production',
      name: 'Embroidery subcontractor',
      amount: '18000',
      incurredAt: fashionDates.expense,
      notes: 'Baseline production expense tied to the ready-to-wear validation week.',
    },
    create: {
      id: fashionIds.finance.expense,
      businessId: fashionIds.business,
      storeId: fashionIds.store,
      supplierId: fashionIds.supplier,
      createdByUserId: fashionIds.user,
      category: 'Production',
      name: 'Embroidery subcontractor',
      amount: '18000',
      incurredAt: fashionDates.expense,
      notes: 'Baseline production expense tied to the ready-to-wear validation week.',
    },
  });
}

async function ensureFashionReconciliation(prisma: PrismaClient) {
  await prisma.inventoryReconciliation.upsert({
    where: { id: fashionIds.reconciliation.session },
    update: {
      businessId: fashionIds.business,
      storeId: fashionIds.store,
      createdByUserId: fashionIds.user,
      status: ReconciliationStatus.POSTED,
      startedAt: fashionDates.reconciliationStart,
      postedAt: fashionDates.reconciliationPosted,
      notes: 'Baseline posted reconciliation showing one controlled finished SKU correction.',
    },
    create: {
      id: fashionIds.reconciliation.session,
      businessId: fashionIds.business,
      storeId: fashionIds.store,
      createdByUserId: fashionIds.user,
      status: ReconciliationStatus.POSTED,
      startedAt: fashionDates.reconciliationStart,
      postedAt: fashionDates.reconciliationPosted,
      notes: 'Baseline posted reconciliation showing one controlled finished SKU correction.',
    },
  });

  await prisma.reconciliationItem.upsert({
    where: { id: fashionIds.reconciliation.item },
    update: {
      inventoryReconciliationId: fashionIds.reconciliation.session,
      inventoryItemId: fashionIds.inventory.utilityJacketUnit,
      expectedQuantity: '7',
      actualQuantity: '6',
      varianceQuantity: '-1',
    },
    create: {
      id: fashionIds.reconciliation.item,
      inventoryReconciliationId: fashionIds.reconciliation.session,
      inventoryItemId: fashionIds.inventory.utilityJacketUnit,
      expectedQuantity: '7',
      actualQuantity: '6',
      varianceQuantity: '-1',
    },
  });

  await prisma.stockMovement.upsert({
    where: { id: fashionIds.reconciliation.movement },
    update: {
      businessId: fashionIds.business,
      storeId: fashionIds.store,
      inventoryItemId: fashionIds.inventory.utilityJacketUnit,
      createdByUserId: fashionIds.user,
      movementType: StockMovementType.INVENTORY_ADJUSTMENT,
      quantityChange: '-1',
      occurredAt: fashionDates.reconciliationPosted,
      notes: 'Baseline reconciliation adjustment for the finished SKU count.',
      reconciliationItemId: fashionIds.reconciliation.item,
    },
    create: {
      id: fashionIds.reconciliation.movement,
      businessId: fashionIds.business,
      storeId: fashionIds.store,
      inventoryItemId: fashionIds.inventory.utilityJacketUnit,
      createdByUserId: fashionIds.user,
      movementType: StockMovementType.INVENTORY_ADJUSTMENT,
      quantityChange: '-1',
      occurredAt: fashionDates.reconciliationPosted,
      notes: 'Baseline reconciliation adjustment for the finished SKU count.',
      reconciliationItemId: fashionIds.reconciliation.item,
    },
  });
}

async function main() {
  const prisma = new PrismaClient();

  try {
    const { business, role, store, user } = await ensureValidationIdentity(prisma);
    console.log(`✓ Business: ${business.name}`);
    console.log(`✓ Role: ${role.name}`);
    console.log(`✓ Store: ${store.name}`);
    console.log(`✓ User: ${user.fullName}`);

    const { supplier, customer } = await ensureBusinessEntities(prisma);
    console.log(`✓ Supplier: ${supplier.name}`);
    console.log(`✓ Customer: ${customer.name}`);

    await ensureCatalog(prisma);
    console.log('✓ Catalog baseline aligned');

    await ensureStockIns(prisma);
    console.log('✓ Stock baseline aligned');

    await ensureProduction(prisma);
    console.log('✓ Production baseline aligned');

    await ensureWaste(prisma);
    console.log('✓ Waste baseline aligned');

    await ensureSalesAndCollections(prisma);
    console.log('✓ Sales, receipt, and invoice baseline aligned');

    await ensureFinance(prisma);
    console.log('✓ Expense baseline aligned');

    await ensureReconciliation(prisma);
    console.log('✓ Reconciliation baseline aligned');

    const fashionIdentity = await ensureFashionValidationIdentity(prisma);
    console.log(`✓ Fashion business: ${fashionIdentity.business.name}`);
    console.log(`✓ Fashion store: ${fashionIdentity.store.name}`);
    console.log(`✓ Fashion user: ${fashionIdentity.user.fullName}`);

    const fashionEntities = await ensureFashionEntities(prisma);
    console.log(`✓ Fashion supplier: ${fashionEntities.supplier.name}`);
    console.log(`✓ Fashion customer: ${fashionEntities.customer.name}`);

    await ensureFashionCatalog(prisma);
    console.log('✓ Fashion catalog baseline aligned');

    await ensureFashionStockIns(prisma);
    console.log('✓ Fashion stock baseline aligned');

    await ensureFashionProduction(prisma);
    console.log('✓ Fashion production baseline aligned');

    await ensureFashionWaste(prisma);
    console.log('✓ Fashion loss baseline aligned');

    await ensureFashionSalesAndCollections(prisma);
    console.log('✓ Fashion sales, receipt, and invoice baseline aligned');

    await ensureFashionFinance(prisma);
    console.log('✓ Fashion expense baseline aligned');

    await ensureFashionReconciliation(prisma);
    console.log('✓ Fashion reconciliation baseline aligned');

    console.log('\n✓ Validation baselines prepared successfully.');
  } catch (error) {
    console.error('✗ Seed failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
