import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  InventoryItem,
  Prisma,
  StockMovementType,
  Store,
  Supplier,
} from '@prisma/client';
import { AuthUser } from '../../common/auth/auth-user.interface';
import { PrismaService } from '../../common/prisma/prisma.service';
import { toDecimal } from '../../common/utils/decimal.util';
import { CreateStockInDto } from './dto/create-stock-in.dto';
import { ListStockInsQueryDto } from './dto/list-stock-ins-query.dto';

@Injectable()
export class StockInService {
  constructor(private readonly prisma: PrismaService) {}

  async listStockIns(user: AuthUser, storeId: string, query: ListStockInsQueryDto) {
    await this.assertStoreAccess(user.businessId, storeId);

    return this.prisma.stockInRecord.findMany({
      where: {
        businessId: user.businessId,
        storeId,
        supplierId: query.supplierId,
        receivedAt: {
          gte: query.from,
          lte: query.to,
        },
      },
      include: {
        supplier: true,
        createdByUser: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        items: {
          include: {
            inventoryItem: true,
            stockMovement: true,
          },
        },
      },
      orderBy: [{ receivedAt: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async getStockIn(user: AuthUser, storeId: string, stockInId: string) {
    await this.assertStoreAccess(user.businessId, storeId);

    const stockInRecord = await this.prisma.stockInRecord.findFirst({
      where: {
        id: stockInId,
        businessId: user.businessId,
        storeId,
      },
      include: {
        supplier: true,
        createdByUser: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        items: {
          include: {
            inventoryItem: true,
            stockMovement: true,
          },
        },
      },
    });

    if (!stockInRecord) {
      throw new NotFoundException('Stock-in record not found.');
    }

    return stockInRecord;
  }

  async createStockIn(user: AuthUser, storeId: string, dto: CreateStockInDto) {
    await this.assertStoreAccess(user.businessId, storeId);

    const uniqueInventoryItemIds = new Set(dto.items.map((item) => item.inventoryItemId));
    if (uniqueInventoryItemIds.size !== dto.items.length) {
      throw new BadRequestException('Each inventory item may appear only once in a stock-in record.');
    }

    const supplier = dto.supplierId
      ? await this.findSupplierOrThrow(user.businessId, dto.supplierId)
      : null;

    const inventoryItems = await this.findInventoryItemsOrThrow(
      user.businessId,
      Array.from(uniqueInventoryItemIds),
    );

    const inventoryItemMap = new Map(inventoryItems.map((item) => [item.id, item]));
    dto.items.forEach((item) => {
      if (item.quantity <= 0) {
        throw new BadRequestException('Stock-in item quantity must be greater than zero.');
      }

      if (item.unitCost <= 0) {
        throw new BadRequestException('Stock-in item unitCost must be greater than zero.');
      }

      if (!inventoryItemMap.has(item.inventoryItemId)) {
        throw new NotFoundException('One or more inventory items could not be found.');
      }
    });

    return this.prisma.$transaction(async (tx) => {
      const stockInRecord = await tx.stockInRecord.create({
        data: {
          businessId: user.businessId,
          storeId,
          supplierId: supplier?.id,
          createdByUserId: user.userId,
          receivedAt: dto.receivedAt,
          externalReference: dto.externalReference?.trim(),
          notes: dto.notes?.trim(),
        },
      });

      for (const item of dto.items) {
        const totalCost = new Prisma.Decimal(item.quantity).mul(item.unitCost);

        const stockInItem = await tx.stockInItem.create({
          data: {
            stockInRecordId: stockInRecord.id,
            inventoryItemId: item.inventoryItemId,
            quantity: toDecimal(item.quantity)!,
            unitCost: toDecimal(item.unitCost)!,
            totalCost,
            expiryDate: item.expiryDate,
          },
        });

        await tx.stockMovement.create({
          data: {
            businessId: user.businessId,
            storeId,
            inventoryItemId: item.inventoryItemId,
            createdByUserId: user.userId,
            movementType: StockMovementType.STOCK_IN,
            quantityChange: toDecimal(item.quantity)!,
            occurredAt: dto.receivedAt,
            notes: dto.notes?.trim() ?? `Stock-in posted from ${stockInRecord.id}`,
            stockInItemId: stockInItem.id,
          },
        });
      }

      return tx.stockInRecord.findUniqueOrThrow({
        where: { id: stockInRecord.id },
        include: {
          supplier: true,
          createdByUser: {
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          },
          items: {
            include: {
              inventoryItem: true,
              stockMovement: true,
            },
          },
        },
      });
    });
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

  private async findSupplierOrThrow(businessId: string, supplierId: string): Promise<Supplier> {
    const supplier = await this.prisma.supplier.findFirst({
      where: {
        id: supplierId,
        businessId,
        deletedAt: null,
      },
    });

    if (!supplier) {
      throw new NotFoundException('Supplier not found.');
    }

    return supplier;
  }

  private async findInventoryItemsOrThrow(
    businessId: string,
    inventoryItemIds: string[],
  ): Promise<InventoryItem[]> {
    const inventoryItems = await this.prisma.inventoryItem.findMany({
      where: {
        businessId,
        id: { in: inventoryItemIds },
        deletedAt: null,
        isActive: true,
      },
    });

    if (inventoryItems.length !== inventoryItemIds.length) {
      throw new NotFoundException('One or more inventory items could not be found.');
    }

    return inventoryItems;
  }
}