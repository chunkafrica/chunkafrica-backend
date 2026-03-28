import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InventoryItem, Prisma, StockMovementType, Store, WasteCategory } from '@prisma/client';
import { AuthUser } from '../../common/auth/auth-user.interface';
import { PrismaService } from '../../common/prisma/prisma.service';
import { toDecimal } from '../../common/utils/decimal.util';
import { CreateWasteCategoryDto } from './dto/create-waste-category.dto';
import { CreateWasteLogDto } from './dto/create-waste-log.dto';
import { ListWasteCategoriesQueryDto } from './dto/list-waste-categories-query.dto';
import { ListWasteLogsQueryDto } from './dto/list-waste-logs-query.dto';
import { UpdateWasteCategoryDto } from './dto/update-waste-category.dto';

const wasteLogInclude = {
  inventoryItem: true,
  wasteCategory: true,
  createdByUser: {
    select: {
      id: true,
      fullName: true,
      email: true,
    },
  },
  stockMovement: true,
} satisfies Prisma.WasteLogInclude;

type WasteLogWithRelations = Prisma.WasteLogGetPayload<{ include: typeof wasteLogInclude }>;
type DbClient = PrismaService | Prisma.TransactionClient;

@Injectable()
export class WasteService {
  constructor(private readonly prisma: PrismaService) {}

  async listWasteCategories(user: AuthUser, query: ListWasteCategoriesQueryDto) {
    const where: Prisma.WasteCategoryWhereInput = {
      businessId: user.businessId,
      deletedAt: query.includeArchived ? undefined : null,
    };

    if (query.search) {
      where.name = {
        contains: query.search,
        mode: 'insensitive',
      };
    }

    return this.prisma.wasteCategory.findMany({
      where,
      orderBy: { name: 'asc' },
    });
  }

  async getWasteCategory(user: AuthUser, wasteCategoryId: string) {
    return this.findWasteCategoryOrThrow(this.prisma, user.businessId, wasteCategoryId, true);
  }

  async createWasteCategory(user: AuthUser, dto: CreateWasteCategoryDto) {
    try {
      return await this.prisma.wasteCategory.create({
        data: {
          businessId: user.businessId,
          name: dto.name.trim(),
          description: dto.description?.trim(),
        },
      });
    } catch (error) {
      this.handleUniqueConstraint(error, 'A waste category with this name already exists.');
      this.handleForeignKeyConstraint(error, 'Business not found. Contact your administrator.');
      throw error;
    }
  }

  async updateWasteCategory(user: AuthUser, wasteCategoryId: string, dto: UpdateWasteCategoryDto) {
    await this.findWasteCategoryOrThrow(this.prisma, user.businessId, wasteCategoryId);

    try {
      return await this.prisma.wasteCategory.update({
        where: { id: wasteCategoryId },
        data: {
          name: dto.name?.trim(),
          description: dto.description?.trim(),
        },
      });
    } catch (error) {
      this.handleUniqueConstraint(error, 'A waste category with this name already exists.');
      throw error;
    }
  }

  async archiveWasteCategory(user: AuthUser, wasteCategoryId: string) {
    await this.findWasteCategoryOrThrow(this.prisma, user.businessId, wasteCategoryId);

    return this.prisma.wasteCategory.update({
      where: { id: wasteCategoryId },
      data: { deletedAt: new Date() },
    });
  }

  async listWasteLogs(user: AuthUser, storeId: string, query: ListWasteLogsQueryDto) {
    await this.assertStoreAccess(this.prisma, user.businessId, storeId);

    return this.prisma.wasteLog.findMany({
      where: {
        businessId: user.businessId,
        storeId,
        inventoryItemId: query.inventoryItemId,
        wasteCategoryId: query.wasteCategoryId,
        occurredAt: {
          gte: query.from,
          lte: query.to,
        },
      },
      include: wasteLogInclude,
      orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async getWasteLog(user: AuthUser, storeId: string, wasteLogId: string) {
    await this.assertStoreAccess(this.prisma, user.businessId, storeId);
    return this.findWasteLogOrThrow(this.prisma, user.businessId, storeId, wasteLogId);
  }

  async createWasteLog(user: AuthUser, storeId: string, dto: CreateWasteLogDto) {
    if (dto.quantity <= 0) {
      throw new BadRequestException('quantity must be greater than zero.');
    }

    return this.prisma.$transaction(async (tx) => {
      await this.assertStoreAccess(tx, user.businessId, storeId);
      await this.findWasteCategoryOrThrow(tx, user.businessId, dto.wasteCategoryId);
      await this.findInventoryItemOrThrow(tx, user.businessId, dto.inventoryItemId);

      const quantity = toDecimal(dto.quantity)!;
      const onHandResult = await tx.stockMovement.aggregate({
        where: {
          businessId: user.businessId,
          storeId,
          inventoryItemId: dto.inventoryItemId,
          occurredAt: {
            lte: dto.occurredAt,
          },
        },
        _sum: {
          quantityChange: true,
        },
      });

      const onHand = onHandResult._sum.quantityChange ?? new Prisma.Decimal(0);
      if (quantity.greaterThan(onHand)) {
        throw new BadRequestException(
          `Insufficient stock for waste posting. Requested ${quantity.toString()}, available ${onHand.toString()}.`,
        );
      }

      const wasteLog = await tx.wasteLog.create({
        data: {
          businessId: user.businessId,
          storeId,
          inventoryItemId: dto.inventoryItemId,
          wasteCategoryId: dto.wasteCategoryId,
          createdByUserId: user.userId,
          quantity,
          occurredAt: dto.occurredAt,
          note: dto.note?.trim(),
          costAtLossSnapshot:
            dto.costAtLossSnapshot !== undefined ? toDecimal(dto.costAtLossSnapshot) : undefined,
        },
      });

      await tx.stockMovement.create({
        data: {
          businessId: user.businessId,
          storeId,
          inventoryItemId: dto.inventoryItemId,
          createdByUserId: user.userId,
          movementType: StockMovementType.WASTE,
          quantityChange: quantity.negated(),
          occurredAt: dto.occurredAt,
          notes: dto.note?.trim() ?? `Waste posted from ${wasteLog.id}`,
          wasteLogId: wasteLog.id,
        },
      });

      return tx.wasteLog.findUniqueOrThrow({
        where: { id: wasteLog.id },
        include: wasteLogInclude,
      });
    });
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

  private async findWasteCategoryOrThrow(
    db: DbClient,
    businessId: string,
    wasteCategoryId: string,
    includeArchived = false,
  ): Promise<WasteCategory> {
    const wasteCategory = await db.wasteCategory.findFirst({
      where: {
        id: wasteCategoryId,
        businessId,
        deletedAt: includeArchived ? undefined : null,
      },
    });

    if (!wasteCategory) {
      throw new NotFoundException('Waste category not found.');
    }

    return wasteCategory;
  }

  private async findInventoryItemOrThrow(
    db: DbClient,
    businessId: string,
    inventoryItemId: string,
  ): Promise<InventoryItem> {
    const inventoryItem = await db.inventoryItem.findFirst({
      where: {
        id: inventoryItemId,
        businessId,
        deletedAt: null,
        isActive: true,
      },
    });

    if (!inventoryItem) {
      throw new NotFoundException('Inventory item not found.');
    }

    return inventoryItem;
  }

  private async findWasteLogOrThrow(
    db: DbClient,
    businessId: string,
    storeId: string,
    wasteLogId: string,
  ): Promise<WasteLogWithRelations> {
    const wasteLog = await db.wasteLog.findFirst({
      where: {
        id: wasteLogId,
        businessId,
        storeId,
      },
      include: wasteLogInclude,
    });

    if (!wasteLog) {
      throw new NotFoundException('Waste log not found.');
    }

    return wasteLog;
  }

  private handleUniqueConstraint(error: unknown, message: string): asserts error is Prisma.PrismaClientKnownRequestError {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(message);
    }
  }

  private handleForeignKeyConstraint(error: unknown, message: string): asserts error is Prisma.PrismaClientKnownRequestError {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2003'
    ) {
      throw new BadRequestException(message);
    }
  }
}