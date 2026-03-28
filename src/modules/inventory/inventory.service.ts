import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InventoryItem, Prisma, Store } from '@prisma/client';
import { AuthUser } from '../../common/auth/auth-user.interface';
import { PrismaService } from '../../common/prisma/prisma.service';
import { toDecimal } from '../../common/utils/decimal.util';
import { CreateInventoryItemDto } from './dto/create-inventory-item.dto';
import { InventoryBalancesQueryDto } from './dto/inventory-balances-query.dto';
import { ListInventoryItemsQueryDto } from './dto/list-inventory-items-query.dto';
import { ListStockMovementsQueryDto } from './dto/list-stock-movements-query.dto';
import { UpdateInventoryItemDto } from './dto/update-inventory-item.dto';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async listInventoryItems(user: AuthUser, query: ListInventoryItemsQueryDto) {
    const where: Prisma.InventoryItemWhereInput = {
      businessId: user.businessId,
      deletedAt: query.includeArchived ? undefined : null,
      itemType: query.itemType,
    };

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { sku: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.inventoryItem.findMany({
      where,
      orderBy: { name: 'asc' },
    });
  }

  async getInventoryItem(user: AuthUser, inventoryItemId: string) {
    return this.findInventoryItemOrThrow(user.businessId, inventoryItemId, true);
  }

  async createInventoryItem(user: AuthUser, dto: CreateInventoryItemDto) {
    try {
      return await this.prisma.inventoryItem.create({
        data: {
          businessId: user.businessId,
          name: dto.name.trim(),
          sku: dto.sku?.trim(),
          description: dto.description?.trim(),
          itemType: dto.itemType,
          unitOfMeasure: dto.unitOfMeasure.trim(),
          defaultCostPerUnit: toDecimal(dto.defaultCostPerUnit),
          defaultSellingPrice: toDecimal(dto.defaultSellingPrice),
          restockPoint: toDecimal(dto.restockPoint),
          isActive: dto.isActive ?? true,
          trackExpiry: dto.trackExpiry ?? false,
        },
      });
    } catch (error) {
      this.handleUniqueConstraint(error, 'An inventory item with this identity already exists.');
      throw error;
    }
  }

  async updateInventoryItem(user: AuthUser, inventoryItemId: string, dto: UpdateInventoryItemDto) {
    const inventoryItem = await this.findInventoryItemOrThrow(user.businessId, inventoryItemId);
    const hasLedgerHistory = await this.hasLedgerHistory(inventoryItemId);

    if (hasLedgerHistory) {
      if (dto.itemType && dto.itemType !== inventoryItem.itemType) {
        throw new BadRequestException('itemType cannot be changed after ledger history exists.');
      }

      if (dto.unitOfMeasure && dto.unitOfMeasure.trim() !== inventoryItem.unitOfMeasure) {
        throw new BadRequestException('unitOfMeasure cannot be changed after ledger history exists.');
      }
    }

    try {
      return await this.prisma.inventoryItem.update({
        where: { id: inventoryItemId },
        data: {
          name: dto.name?.trim(),
          sku: dto.sku?.trim(),
          description: dto.description?.trim(),
          itemType: dto.itemType,
          unitOfMeasure: dto.unitOfMeasure?.trim(),
          defaultCostPerUnit:
            dto.defaultCostPerUnit !== undefined ? toDecimal(dto.defaultCostPerUnit) : undefined,
          defaultSellingPrice:
            dto.defaultSellingPrice !== undefined ? toDecimal(dto.defaultSellingPrice) : undefined,
          restockPoint: dto.restockPoint !== undefined ? toDecimal(dto.restockPoint) : undefined,
          isActive: dto.isActive,
          trackExpiry: dto.trackExpiry,
        },
      });
    } catch (error) {
      this.handleUniqueConstraint(error, 'An inventory item with this identity already exists.');
      throw error;
    }
  }

  async archiveInventoryItem(user: AuthUser, inventoryItemId: string) {
    await this.findInventoryItemOrThrow(user.businessId, inventoryItemId);

    return this.prisma.inventoryItem.update({
      where: { id: inventoryItemId },
      data: { deletedAt: new Date() },
    });
  }

  async getOnHandInventory(user: AuthUser, storeId: string, query: InventoryBalancesQueryDto) {
    await this.assertStoreAccess(user.businessId, storeId);

    const items = await this.prisma.inventoryItem.findMany({
      where: {
        businessId: user.businessId,
        deletedAt: null,
        isActive: query.includeInactive ? undefined : true,
        itemType: query.itemType,
        OR: query.search
          ? [
              { name: { contains: query.search, mode: 'insensitive' } },
              { sku: { contains: query.search, mode: 'insensitive' } },
            ]
          : undefined,
      },
      orderBy: { name: 'asc' },
    });

    return this.attachDerivedBalances(user.businessId, storeId, items, query.asOf);
  }

  async getLowStockInventory(user: AuthUser, storeId: string, query: InventoryBalancesQueryDto) {
    const balances = await this.getOnHandInventory(user, storeId, query);

    return balances.filter((item) => {
      if (item.restockPoint === null) {
        return false;
      }

      return item.onHandQuantity.lessThanOrEqualTo(item.restockPoint);
    });
  }

  async listInventoryItemMovements(
    user: AuthUser,
    storeId: string,
    inventoryItemId: string,
    query: ListStockMovementsQueryDto,
  ) {
    await this.assertStoreAccess(user.businessId, storeId);
    await this.findInventoryItemOrThrow(user.businessId, inventoryItemId, true);

    return this.prisma.stockMovement.findMany({
      where: {
        businessId: user.businessId,
        storeId,
        inventoryItemId,
        movementType: query.movementType,
        occurredAt: {
          gte: query.from,
          lte: query.to,
        },
      },
      include: {
        stockInItem: {
          include: {
            stockInRecord: {
              include: {
                supplier: true,
              },
            },
          },
        },
      },
      orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
    });
  }

  private async attachDerivedBalances(
    businessId: string,
    storeId: string,
    items: InventoryItem[],
    asOf?: Date,
  ) {
    const groupedMovements = items.length
      ? await this.prisma.stockMovement.groupBy({
          by: ['inventoryItemId'],
          where: {
            businessId,
            storeId,
            inventoryItemId: { in: items.map((item) => item.id) },
            occurredAt: asOf ? { lte: asOf } : undefined,
          },
          _sum: { quantityChange: true },
          _max: { occurredAt: true },
        })
      : [];

    const balanceMap = new Map(
      groupedMovements.map((movement) => [movement.inventoryItemId, movement]),
    );

    return items.map((item) => {
      const aggregate = balanceMap.get(item.id);

      return {
        ...item,
        onHandQuantity: aggregate?._sum.quantityChange ?? new Prisma.Decimal(0),
        lastMovementAt: aggregate?._max.occurredAt ?? null,
      };
    });
  }

  private async hasLedgerHistory(inventoryItemId: string) {
    const movementsCount = await this.prisma.stockMovement.count({
      where: { inventoryItemId },
    });

    return movementsCount > 0;
  }

  private async assertStoreAccess(businessId: string, storeId: string): Promise<Store> {
    const store = await this.prisma.store.findFirst({
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

  private async findInventoryItemOrThrow(
    businessId: string,
    inventoryItemId: string,
    includeArchived = false,
  ): Promise<InventoryItem> {
    const inventoryItem = await this.prisma.inventoryItem.findFirst({
      where: {
        id: inventoryItemId,
        businessId,
        deletedAt: includeArchived ? undefined : null,
      },
    });

    if (!inventoryItem) {
      throw new NotFoundException('Inventory item not found.');
    }

    return inventoryItem;
  }

  private handleUniqueConstraint(error: unknown, message: string): asserts error is Prisma.PrismaClientKnownRequestError {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(message);
    }
  }
}