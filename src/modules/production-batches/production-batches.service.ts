import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  ProductionBatchStatus,
  StockMovementType,
  Store,
} from '@prisma/client';
import { AuthUser } from '../../common/auth/auth-user.interface';
import { PrismaService } from '../../common/prisma/prisma.service';
import { toDecimal } from '../../common/utils/decimal.util';
import { CompleteProductionBatchDto } from './dto/complete-production-batch.dto';
import { CreateProductionBatchDto } from './dto/create-production-batch.dto';
import { ListProductionBatchesQueryDto } from './dto/list-production-batches-query.dto';
import { UpdateProductionBatchDto } from './dto/update-production-batch.dto';

const batchDetailInclude = {
  menuItem: true,
  recipe: {
    include: {
      producedInventoryItem: true,
      recipeItems: {
        include: {
          inventoryItem: true,
        },
      },
    },
  },
  producedInventoryItem: true,
  createdByUser: {
    select: {
      id: true,
      fullName: true,
      email: true,
    },
  },
  ingredients: {
    include: {
      inventoryItem: true,
      stockMovement: true,
    },
  },
  outputStockMovement: true,
} satisfies Prisma.ProductionBatchInclude;

const batchSummaryInclude = {
  menuItem: true,
  recipe: {
    select: {
      id: true,
      name: true,
      version: true,
      isActive: true,
      yieldQuantity: true,
    },
  },
  producedInventoryItem: true,
  createdByUser: {
    select: {
      id: true,
      fullName: true,
      email: true,
    },
  },
  _count: {
    select: {
      ingredients: true,
    },
  },
} satisfies Prisma.ProductionBatchInclude;

type ProductionBatchWithRelations = Prisma.ProductionBatchGetPayload<{
  include: typeof batchDetailInclude;
}>;
type ProductionBatchSummaryRecord = Prisma.ProductionBatchGetPayload<{
  include: typeof batchSummaryInclude;
}>;
type ActiveRecipeForBatch = Prisma.RecipeGetPayload<{
  include: {
    producedInventoryItem: true;
    recipeItems: {
      include: {
        inventoryItem: true;
      };
    };
  };
}>;
type DbClient = PrismaService | Prisma.TransactionClient;

@Injectable()
export class ProductionBatchesService {
  constructor(private readonly prisma: PrismaService) {}

  async listProductionBatches(
    user: AuthUser,
    storeId: string,
    query: ListProductionBatchesQueryDto,
  ) {
    await this.assertStoreAccess(this.prisma, user.businessId, storeId);

    const batches = await this.prisma.productionBatch.findMany({
      where: {
        businessId: user.businessId,
        storeId,
        status: query.status,
        batchDate: {
          gte: query.from,
          lte: query.to,
        },
      },
      include: batchSummaryInclude,
      orderBy: [{ batchDate: 'desc' }, { createdAt: 'desc' }],
    });

    return batches.map((batch) => this.serializeBatchSummary(batch));
  }

  async getProductionBatch(user: AuthUser, storeId: string, batchId: string) {
    await this.assertStoreAccess(this.prisma, user.businessId, storeId);
    const batch = await this.findBatchOrThrow(this.prisma, user.businessId, storeId, batchId);
    return this.serializeBatchDetail(batch);
  }

  async createProductionBatch(
    user: AuthUser,
    storeId: string,
    dto: CreateProductionBatchDto,
  ) {
    await this.assertStoreAccess(this.prisma, user.businessId, storeId);

    return this.prisma.$transaction(async (tx) => {
      const recipe = await this.findActiveRecipeForBatchOrThrow(
        tx,
        user.businessId,
        dto.recipeId,
      );

      const batchNumber = await this.resolveBatchNumber(
        tx,
        user.businessId,
        dto.batchDate,
        dto.batchNumber,
      );

      const expectedOutputQuantity =
        dto.plannedOutputQuantity !== undefined
          ? toDecimal(dto.plannedOutputQuantity)!
          : recipe.yieldQuantity;
      const { expectedTotalCost, expectedUnitCost } = this.computeExpectedCostsFromRecipe(
        recipe,
        expectedOutputQuantity,
      );

      const createdBatch = await tx.productionBatch.create({
        data: {
          businessId: user.businessId,
          storeId,
          menuItemId: recipe.menuItemId,
          recipeId: recipe.id,
          producedInventoryItemId: recipe.producedInventoryItemId,
          createdByUserId: user.userId,
          batchNumber,
          recipeVersionUsed: recipe.version,
          batchDate: dto.batchDate,
          plannedOutputQuantity: expectedOutputQuantity,
          actualOutputQuantity: new Prisma.Decimal(0),
          outputVarianceQuantity: new Prisma.Decimal(0),
          expectedTotalCost,
          expectedUnitCost,
          actualTotalCost: new Prisma.Decimal(0),
          actualUnitCost: new Prisma.Decimal(0),
          status: ProductionBatchStatus.PLANNED,
          notes: dto.notes?.trim(),
        },
        include: batchDetailInclude,
      });

      return this.serializeBatchDetail(createdBatch);
    });
  }

  async updateProductionBatch(
    user: AuthUser,
    storeId: string,
    batchId: string,
    dto: UpdateProductionBatchDto,
  ) {
    await this.assertStoreAccess(this.prisma, user.businessId, storeId);

    return this.prisma.$transaction(async (tx) => {
      const batch = await this.findBatchOrThrow(tx, user.businessId, storeId, batchId);
      this.assertBatchEditable(batch.status);

      let nextMenuItemId = batch.menuItemId;
      let nextRecipeId = batch.recipeId;
      let nextProducedInventoryItemId = batch.producedInventoryItemId;
      let nextRecipeVersionUsed = batch.recipeVersionUsed;
      let nextRecipe = batch.recipe;

      if (dto.recipeId) {
        nextRecipeId = dto.recipeId;

        const recipe = await this.findActiveRecipeForBatchOrThrow(
          tx,
          user.businessId,
          nextRecipeId,
        );

        nextMenuItemId = recipe.menuItemId;
        nextProducedInventoryItemId = recipe.producedInventoryItemId;
        nextRecipeVersionUsed = recipe.version;
        nextRecipe = recipe;
      }

      const nextBatchNumber = dto.batchNumber
        ? await this.resolveBatchNumber(
            tx,
            user.businessId,
            dto.batchDate ?? batch.batchDate,
            dto.batchNumber,
            batch.id,
          )
        : batch.batchNumber;

      let expectedTotalCostUpdate: Prisma.Decimal | undefined;
      let expectedUnitCostUpdate: Prisma.Decimal | undefined;

      if (dto.plannedOutputQuantity !== undefined || dto.recipeId) {
        const expectedOutputQuantity =
          dto.plannedOutputQuantity !== undefined
            ? toDecimal(dto.plannedOutputQuantity)!
            : batch.plannedOutputQuantity ?? nextRecipe.yieldQuantity;
        const expectedCosts = this.computeExpectedCostsFromRecipe(
          nextRecipe,
          expectedOutputQuantity,
        );
        expectedTotalCostUpdate = expectedCosts.expectedTotalCost;
        expectedUnitCostUpdate = expectedCosts.expectedUnitCost;
      }

      const updatedBatch = await tx.productionBatch.update({
        where: { id: batch.id },
        data: {
          menuItemId: nextMenuItemId,
          recipeId: nextRecipeId,
          producedInventoryItemId: nextProducedInventoryItemId,
          recipeVersionUsed: nextRecipeVersionUsed,
          batchDate: dto.batchDate,
          plannedOutputQuantity:
            dto.plannedOutputQuantity !== undefined
              ? toDecimal(dto.plannedOutputQuantity)
              : undefined,
          expectedTotalCost: expectedTotalCostUpdate,
          expectedUnitCost: expectedUnitCostUpdate,
          batchNumber: nextBatchNumber,
          notes: dto.notes?.trim(),
        },
        include: batchDetailInclude,
      });

      return this.serializeBatchDetail(updatedBatch);
    });
  }

  async startProductionBatch(user: AuthUser, storeId: string, batchId: string) {
    await this.assertStoreAccess(this.prisma, user.businessId, storeId);

    const batch = await this.findBatchOrThrow(this.prisma, user.businessId, storeId, batchId);
    if (batch.status !== ProductionBatchStatus.PLANNED) {
      throw new BadRequestException('Only PLANNED batches can be started.');
    }

    const startedBatch = await this.prisma.productionBatch.update({
      where: { id: batch.id },
      data: { status: ProductionBatchStatus.IN_PROGRESS },
      include: batchDetailInclude,
    });

    return this.serializeBatchDetail(startedBatch);
  }

  async completeProductionBatch(
    user: AuthUser,
    storeId: string,
    batchId: string,
    dto: CompleteProductionBatchDto,
  ) {
    await this.assertStoreAccess(this.prisma, user.businessId, storeId);

    return this.prisma.$transaction(async (tx) => {
      const batch = await this.findBatchOrThrow(tx, user.businessId, storeId, batchId);
      this.assertBatchCompletable(batch.status);

      if (batch.ingredients.length > 0 || batch.outputStockMovement) {
        throw new ConflictException('This batch already has posted production records.');
      }

      const recipe = batch.recipe;
      if (recipe.yieldQuantity.lessThanOrEqualTo(0)) {
        throw new BadRequestException('The selected recipe has an invalid yield quantity.');
      }

      const expectedOutputQuantity = batch.plannedOutputQuantity ?? recipe.yieldQuantity;
      if (expectedOutputQuantity.lessThanOrEqualTo(0)) {
        throw new BadRequestException('The selected batch has an invalid expected output quantity.');
      }

      const outputQuantity = toDecimal(dto.actualOutputQuantity)!;
      const outputVarianceQuantity = outputQuantity.minus(expectedOutputQuantity);
      const completedAt = dto.completedAt;
      const ingredientOverrides = new Map<string, Prisma.Decimal>();
      const overrideIds = new Set<string>();

      for (const item of dto.ingredients ?? []) {
        if (overrideIds.has(item.inventoryItemId)) {
          throw new BadRequestException('Each ingredient override may appear only once.');
        }

        overrideIds.add(item.inventoryItemId);
        ingredientOverrides.set(item.inventoryItemId, toDecimal(item.actualQuantity)!);
      }

      const recipeIngredientIds = new Set(recipe.recipeItems.map((item) => item.inventoryItemId));
      for (const ingredientId of overrideIds) {
        if (!recipeIngredientIds.has(ingredientId)) {
          throw new BadRequestException('Ingredient overrides must match the selected recipe.');
        }
      }

      const usageLines = recipe.recipeItems.map((item) => {
        const expectedQuantity = item.quantityRequired
          .mul(expectedOutputQuantity)
          .div(recipe.yieldQuantity);
        const actualQuantity = ingredientOverrides.get(item.inventoryItemId) ?? expectedQuantity;
        const varianceQuantity = actualQuantity.minus(expectedQuantity);
        const defaultCostPerUnit = item.inventoryItem.defaultCostPerUnit ?? new Prisma.Decimal(0);

        return {
          inventoryItemId: item.inventoryItemId,
          inventoryItemName: item.inventoryItem.name,
          expectedQuantity,
          actualQuantity,
          varianceQuantity,
          defaultCostPerUnit,
        };
      });

      const costSnapshots = usageLines.length
        ? await tx.stockMovement.findMany({
            where: {
              businessId: user.businessId,
              storeId,
              inventoryItemId: { in: usageLines.map((line) => line.inventoryItemId) },
              occurredAt: { lte: completedAt },
              unitCostSnapshot: { not: null },
            },
            select: {
              inventoryItemId: true,
              unitCostSnapshot: true,
              occurredAt: true,
              createdAt: true,
            },
            orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
          })
        : [];

      const costSnapshotMap = new Map<string, Prisma.Decimal>();
      for (const snapshot of costSnapshots) {
        if (!costSnapshotMap.has(snapshot.inventoryItemId) && snapshot.unitCostSnapshot) {
          costSnapshotMap.set(snapshot.inventoryItemId, snapshot.unitCostSnapshot);
        }
      }

      const costedUsageLines = usageLines.map((line) => {
        const unitCostSnapshot =
          costSnapshotMap.get(line.inventoryItemId) ?? line.defaultCostPerUnit;
        const expectedCost = line.expectedQuantity.mul(unitCostSnapshot);
        const actualCost = line.actualQuantity.mul(unitCostSnapshot);

        return {
          ...line,
          unitCostSnapshot,
          expectedCost,
          actualCost,
        };
      });

      const groupedBalances = costedUsageLines.length
        ? await tx.stockMovement.groupBy({
            by: ['inventoryItemId'],
            where: {
              businessId: user.businessId,
              storeId,
              inventoryItemId: { in: costedUsageLines.map((line) => line.inventoryItemId) },
              occurredAt: { lte: completedAt },
            },
            _sum: {
              quantityChange: true,
            },
          })
        : [];

      const balanceMap = new Map(
        groupedBalances.map((entry) => [
          entry.inventoryItemId,
          entry._sum.quantityChange ?? new Prisma.Decimal(0),
        ]),
      );

      const insufficientIngredients = costedUsageLines.filter((line) => {
        const onHand = balanceMap.get(line.inventoryItemId) ?? new Prisma.Decimal(0);
        return line.actualQuantity.greaterThan(onHand);
      });

      if (insufficientIngredients.length > 0) {
        const detail = insufficientIngredients
          .map((line) => {
            const onHand = balanceMap.get(line.inventoryItemId) ?? new Prisma.Decimal(0);
            return `${line.inventoryItemName} (needed ${line.actualQuantity.toString()}, on hand ${onHand.toString()})`;
          })
          .join(', ');

        throw new BadRequestException(`Insufficient stock for production completion: ${detail}`);
      }

      for (const line of costedUsageLines) {
        const ingredientRecord = await tx.productionBatchIngredient.create({
          data: {
            productionBatchId: batch.id,
            inventoryItemId: line.inventoryItemId,
            expectedQuantity: line.expectedQuantity,
            actualQuantity: line.actualQuantity,
            varianceQuantity: line.varianceQuantity,
            unitCostSnapshot: line.unitCostSnapshot,
            expectedCost: line.expectedCost,
            actualCost: line.actualCost,
          },
        });

        await tx.stockMovement.create({
          data: {
            businessId: user.businessId,
            storeId,
            inventoryItemId: line.inventoryItemId,
            createdByUserId: user.userId,
            movementType: StockMovementType.PRODUCTION_USE,
            quantityChange: line.actualQuantity.negated(),
            unitCostSnapshot: line.unitCostSnapshot,
            totalCostSnapshot: line.actualCost,
            occurredAt: completedAt,
            notes: `Production input for batch ${batch.batchNumber ?? batch.id}`,
            productionBatchIngredientId: ingredientRecord.id,
          },
        });
      }

      const expectedTotalCost = costedUsageLines.reduce(
        (total, line) => total.plus(line.expectedCost),
        new Prisma.Decimal(0),
      );
      const actualTotalCost = costedUsageLines.reduce(
        (total, line) => total.plus(line.actualCost),
        new Prisma.Decimal(0),
      );
      const expectedUnitCost = expectedOutputQuantity.equals(0)
        ? new Prisma.Decimal(0)
        : expectedTotalCost.div(expectedOutputQuantity);
      const actualUnitCost = outputQuantity.equals(0)
        ? new Prisma.Decimal(0)
        : actualTotalCost.div(outputQuantity);

      await tx.stockMovement.create({
        data: {
          businessId: user.businessId,
          storeId,
          inventoryItemId: batch.producedInventoryItemId,
          createdByUserId: user.userId,
          movementType: StockMovementType.PRODUCTION_OUTPUT,
          quantityChange: outputQuantity,
          unitCostSnapshot: actualUnitCost,
          totalCostSnapshot: actualTotalCost,
          occurredAt: completedAt,
          notes: `Production output for batch ${batch.batchNumber ?? batch.id}`,
          productionBatchId: batch.id,
        },
      });

      await tx.productionBatch.update({
        where: { id: batch.id },
        data: {
          actualOutputQuantity: outputQuantity,
          outputVarianceQuantity,
          expectedTotalCost,
          expectedUnitCost,
          actualTotalCost,
          actualUnitCost,
          recipeVersionUsed: recipe.version,
          producedInventoryItemId: recipe.producedInventoryItemId,
          menuItemId: recipe.menuItemId,
          status: ProductionBatchStatus.COMPLETED,
          notes: dto.notes?.trim() ?? batch.notes,
        },
      });

      const completedBatch = await tx.productionBatch.findUniqueOrThrow({
        where: { id: batch.id },
        include: batchDetailInclude,
      });

      return this.serializeBatchDetail(completedBatch);
    });
  }

  async cancelProductionBatch(user: AuthUser, storeId: string, batchId: string) {
    await this.assertStoreAccess(this.prisma, user.businessId, storeId);

    const batch = await this.findBatchOrThrow(this.prisma, user.businessId, storeId, batchId);
    this.assertBatchEditable(batch.status);

    const cancelledBatch = await this.prisma.productionBatch.update({
      where: { id: batch.id },
      data: { status: ProductionBatchStatus.CANCELLED },
      include: batchDetailInclude,
    });

    return this.serializeBatchDetail(cancelledBatch);
  }

  private serializeBatchSummary(batch: ProductionBatchSummaryRecord) {
    const definitionName =
      batch.menuItem?.name ?? batch.recipe?.name ?? batch.producedInventoryItem.name;

    return {
      ...batch,
      menuItem: batch.menuItem ?? {
        id: batch.recipe.id,
        name: definitionName,
      },
      outputVarianceQuantity: batch.outputVarianceQuantity ?? new Prisma.Decimal(0),
      expectedOutputQuantity: batch.plannedOutputQuantity ?? batch.recipe.yieldQuantity,
      expectedTotalCost: batch.expectedTotalCost ?? new Prisma.Decimal(0),
      expectedUnitCost: batch.expectedUnitCost ?? new Prisma.Decimal(0),
      actualTotalCost: batch.actualTotalCost ?? new Prisma.Decimal(0),
      actualUnitCost: batch.actualUnitCost ?? new Prisma.Decimal(0),
    };
  }

  private serializeBatchDetail(batch: ProductionBatchWithRelations) {
    const definitionName =
      batch.menuItem?.name ?? batch.recipe.name ?? batch.producedInventoryItem.name;

    return {
      ...batch,
      menuItem: batch.menuItem ?? {
        id: batch.recipe.id,
        name: definitionName,
      },
      outputVarianceQuantity: batch.outputVarianceQuantity ?? new Prisma.Decimal(0),
      expectedOutputQuantity: batch.plannedOutputQuantity ?? batch.recipe.yieldQuantity,
      expectedTotalCost: batch.expectedTotalCost ?? new Prisma.Decimal(0),
      expectedUnitCost: batch.expectedUnitCost ?? new Prisma.Decimal(0),
      actualTotalCost: batch.actualTotalCost ?? new Prisma.Decimal(0),
      actualUnitCost: batch.actualUnitCost ?? new Prisma.Decimal(0),
    };
  }

  private async findBatchOrThrow(
    db: DbClient,
    businessId: string,
    storeId: string,
    batchId: string,
  ): Promise<ProductionBatchWithRelations> {
    const batch = await db.productionBatch.findFirst({
      where: {
        id: batchId,
        businessId,
        storeId,
      },
      include: batchDetailInclude,
    });

    if (!batch) {
      throw new NotFoundException('Production batch not found.');
    }

    return batch;
  }

  private async assertStoreAccess(db: DbClient, businessId: string, storeId: string): Promise<Store> {
    const store = await db.store.findFirst({
      where: {
        id: storeId,
        businessId,
        deletedAt: null,
        isActive: true,
      },
    });

    if (!store) {
      throw new NotFoundException('Store not found.');
    }

    return store;
  }

  private async findActiveRecipeForBatchOrThrow(
    db: DbClient,
    businessId: string,
    recipeId: string,
  ): Promise<ActiveRecipeForBatch> {
    const recipe = await db.recipe.findFirst({
      where: {
        id: recipeId,
        businessId,
        isActive: true,
        deletedAt: null,
      },
      include: {
        producedInventoryItem: true,
        recipeItems: {
          include: {
            inventoryItem: true,
          },
        },
      },
    });

    if (!recipe) {
      throw new NotFoundException('Active production definition not found.');
    }

    return recipe;
  }

  private assertBatchEditable(status: ProductionBatchStatus) {
    if (
      status !== ProductionBatchStatus.PLANNED &&
      status !== ProductionBatchStatus.IN_PROGRESS
    ) {
      throw new BadRequestException(
        'Only PLANNED or IN_PROGRESS batches can be edited or cancelled.',
      );
    }
  }

  private assertBatchCompletable(status: ProductionBatchStatus) {
    if (
      status !== ProductionBatchStatus.PLANNED &&
      status !== ProductionBatchStatus.IN_PROGRESS
    ) {
      throw new BadRequestException(
        'Only PLANNED or IN_PROGRESS batches can be completed.',
      );
    }
  }

  private computeExpectedCostsFromRecipe(
    recipe: ActiveRecipeForBatch,
    expectedOutputQuantity: Prisma.Decimal,
  ) {
    const zero = new Prisma.Decimal(0);

    if (expectedOutputQuantity.lessThanOrEqualTo(0)) {
      return { expectedTotalCost: zero, expectedUnitCost: zero };
    }

    const expectedTotalCost = recipe.recipeItems.reduce((total, item) => {
      const unitCost = item.inventoryItem.defaultCostPerUnit ?? zero;
      const expectedQuantity = item.quantityRequired
        .mul(expectedOutputQuantity)
        .div(recipe.yieldQuantity);
      return total.plus(unitCost.mul(expectedQuantity));
    }, new Prisma.Decimal(0));

    const expectedUnitCost = expectedTotalCost.div(expectedOutputQuantity);

    return { expectedTotalCost, expectedUnitCost };
  }

  private async resolveBatchNumber(
    db: DbClient,
    businessId: string,
    batchDate: Date,
    requestedBatchNumber?: string,
    excludeBatchId?: string,
  ): Promise<string> {
    if (requestedBatchNumber) {
      const batchNumber = requestedBatchNumber.trim();
      await this.ensureBatchNumberAvailable(db, businessId, batchNumber, excludeBatchId);
      return batchNumber;
    }

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const candidate = this.generateBatchNumber(batchDate);
      const existing = await db.productionBatch.findFirst({
        where: {
          businessId,
          batchNumber: candidate,
        },
        select: { id: true },
      });

      if (!existing || existing.id === excludeBatchId) {
        return candidate;
      }
    }

    throw new ConflictException('Could not generate a unique batch number. Please retry.');
  }

  private async ensureBatchNumberAvailable(
    db: DbClient,
    businessId: string,
    batchNumber: string,
    excludeBatchId?: string,
  ) {
    const existing = await db.productionBatch.findFirst({
      where: {
        businessId,
        batchNumber,
        id: excludeBatchId ? { not: excludeBatchId } : undefined,
      },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException('A production batch with this batch number already exists.');
    }
  }

  private generateBatchNumber(batchDate: Date): string {
    const year = batchDate.getUTCFullYear();
    const month = `${batchDate.getUTCMonth() + 1}`.padStart(2, '0');
    const day = `${batchDate.getUTCDate()}`.padStart(2, '0');
    const suffix = `${Date.now()}`.slice(-6);

    return `PB-${year}${month}${day}-${suffix}`;
  }
}
