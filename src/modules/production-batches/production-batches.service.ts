import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  MenuItem,
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

type ProductionBatchWithRelations = Prisma.ProductionBatchGetPayload<{
  include: typeof batchDetailInclude;
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

    return this.prisma.productionBatch.findMany({
      where: {
        businessId: user.businessId,
        storeId,
        status: query.status,
        batchDate: {
          gte: query.from,
          lte: query.to,
        },
      },
      include: {
        menuItem: true,
        recipe: {
          select: {
            id: true,
            version: true,
            isActive: true,
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
      },
      orderBy: [{ batchDate: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async getProductionBatch(user: AuthUser, storeId: string, batchId: string) {
    await this.assertStoreAccess(this.prisma, user.businessId, storeId);
    return this.findBatchOrThrow(this.prisma, user.businessId, storeId, batchId);
  }

  async createProductionBatch(
    user: AuthUser,
    storeId: string,
    dto: CreateProductionBatchDto,
  ) {
    await this.assertStoreAccess(this.prisma, user.businessId, storeId);

    return this.prisma.$transaction(async (tx) => {
      await this.findMenuItemOrThrow(tx, user.businessId, dto.menuItemId);
      const recipe = await this.findActiveRecipeForBatchOrThrow(
        tx,
        user.businessId,
        dto.menuItemId,
        dto.recipeId,
      );

      const batchNumber = await this.resolveBatchNumber(
        tx,
        user.businessId,
        dto.batchDate,
        dto.batchNumber,
      );

      return tx.productionBatch.create({
        data: {
          businessId: user.businessId,
          storeId,
          menuItemId: dto.menuItemId,
          recipeId: recipe.id,
          producedInventoryItemId: recipe.producedInventoryItemId,
          createdByUserId: user.userId,
          batchNumber,
          recipeVersionUsed: recipe.version,
          batchDate: dto.batchDate,
          plannedOutputQuantity:
            dto.plannedOutputQuantity !== undefined ? toDecimal(dto.plannedOutputQuantity) : null,
          actualOutputQuantity: new Prisma.Decimal(0),
          status: ProductionBatchStatus.PLANNED,
          notes: dto.notes?.trim(),
        },
        include: batchDetailInclude,
      });
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

      if (dto.menuItemId || dto.recipeId) {
        nextMenuItemId = dto.menuItemId ?? batch.menuItemId;
        nextRecipeId = dto.recipeId ?? batch.recipeId;

        await this.findMenuItemOrThrow(tx, user.businessId, nextMenuItemId);
        const recipe = await this.findActiveRecipeForBatchOrThrow(
          tx,
          user.businessId,
          nextMenuItemId,
          nextRecipeId,
        );

        nextProducedInventoryItemId = recipe.producedInventoryItemId;
        nextRecipeVersionUsed = recipe.version;
      }

      const nextBatchNumber = dto.batchNumber
        ? await this.resolveBatchNumber(tx, user.businessId, batch.batchDate, dto.batchNumber, batch.id)
        : batch.batchNumber;

      return tx.productionBatch.update({
        where: { id: batch.id },
        data: {
          menuItemId: nextMenuItemId,
          recipeId: nextRecipeId,
          producedInventoryItemId: nextProducedInventoryItemId,
          recipeVersionUsed: nextRecipeVersionUsed,
          batchDate: dto.batchDate,
          plannedOutputQuantity:
            dto.plannedOutputQuantity !== undefined ? toDecimal(dto.plannedOutputQuantity) : undefined,
          batchNumber: nextBatchNumber,
          notes: dto.notes?.trim(),
        },
        include: batchDetailInclude,
      });
    });
  }

  async startProductionBatch(user: AuthUser, storeId: string, batchId: string) {
    await this.assertStoreAccess(this.prisma, user.businessId, storeId);

    const batch = await this.findBatchOrThrow(this.prisma, user.businessId, storeId, batchId);
    if (batch.status !== ProductionBatchStatus.PLANNED) {
      throw new BadRequestException('Only PLANNED batches can be started.');
    }

    return this.prisma.productionBatch.update({
      where: { id: batch.id },
      data: { status: ProductionBatchStatus.IN_PROGRESS },
      include: batchDetailInclude,
    });
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

      const outputQuantity = toDecimal(dto.actualOutputQuantity)!;
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
        const expectedQuantity = item.quantityRequired.mul(outputQuantity).div(recipe.yieldQuantity);
        const actualQuantity = ingredientOverrides.get(item.inventoryItemId) ?? expectedQuantity;
        const varianceQuantity = actualQuantity.minus(expectedQuantity);

        return {
          inventoryItemId: item.inventoryItemId,
          inventoryItemName: item.inventoryItem.name,
          expectedQuantity,
          actualQuantity,
          varianceQuantity,
        };
      });

      const groupedBalances = usageLines.length
        ? await tx.stockMovement.groupBy({
            by: ['inventoryItemId'],
            where: {
              businessId: user.businessId,
              storeId,
              inventoryItemId: { in: usageLines.map((line) => line.inventoryItemId) },
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

      const insufficientIngredients = usageLines.filter((line) => {
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

      for (const line of usageLines) {
        const ingredientRecord = await tx.productionBatchIngredient.create({
          data: {
            productionBatchId: batch.id,
            inventoryItemId: line.inventoryItemId,
            expectedQuantity: line.expectedQuantity,
            actualQuantity: line.actualQuantity,
            varianceQuantity: line.varianceQuantity,
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
            occurredAt: completedAt,
            notes: `Production input for batch ${batch.batchNumber ?? batch.id}`,
            productionBatchIngredientId: ingredientRecord.id,
          },
        });
      }

      await tx.stockMovement.create({
        data: {
          businessId: user.businessId,
          storeId,
          inventoryItemId: batch.producedInventoryItemId,
          createdByUserId: user.userId,
          movementType: StockMovementType.PRODUCTION_OUTPUT,
          quantityChange: outputQuantity,
          occurredAt: completedAt,
          notes: `Production output for batch ${batch.batchNumber ?? batch.id}`,
          productionBatchId: batch.id,
        },
      });

      await tx.productionBatch.update({
        where: { id: batch.id },
        data: {
          actualOutputQuantity: outputQuantity,
          recipeVersionUsed: recipe.version,
          producedInventoryItemId: recipe.producedInventoryItemId,
          status: ProductionBatchStatus.COMPLETED,
          notes: dto.notes?.trim() ?? batch.notes,
        },
      });

      return tx.productionBatch.findUniqueOrThrow({
        where: { id: batch.id },
        include: batchDetailInclude,
      });
    });
  }

  async cancelProductionBatch(user: AuthUser, storeId: string, batchId: string) {
    await this.assertStoreAccess(this.prisma, user.businessId, storeId);

    const batch = await this.findBatchOrThrow(this.prisma, user.businessId, storeId, batchId);
    this.assertBatchEditable(batch.status);

    return this.prisma.productionBatch.update({
      where: { id: batch.id },
      data: { status: ProductionBatchStatus.CANCELLED },
      include: batchDetailInclude,
    });
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

  private async findMenuItemOrThrow(
    db: DbClient,
    businessId: string,
    menuItemId: string,
  ): Promise<MenuItem> {
    const menuItem = await db.menuItem.findFirst({
      where: {
        id: menuItemId,
        businessId,
        deletedAt: null,
      },
    });

    if (!menuItem) {
      throw new NotFoundException('Menu item not found.');
    }

    return menuItem;
  }

  private async findActiveRecipeForBatchOrThrow(
    db: DbClient,
    businessId: string,
    menuItemId: string,
    recipeId: string,
  ): Promise<ActiveRecipeForBatch> {
    const recipe = await db.recipe.findFirst({
      where: {
        id: recipeId,
        businessId,
        menuItemId,
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
      throw new NotFoundException(
        'Active recipe not found for the selected menu item.',
      );
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