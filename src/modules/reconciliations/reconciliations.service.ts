import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InventoryItem, Prisma, ReconciliationStatus, StockMovementType, Store } from '@prisma/client';
import { AuthUser } from '../../common/auth/auth-user.interface';
import { PrismaService } from '../../common/prisma/prisma.service';
import { toDecimal } from '../../common/utils/decimal.util';
import { CreateReconciliationDto } from './dto/create-reconciliation.dto';
import { ListReconciliationsQueryDto } from './dto/list-reconciliations-query.dto';
import { UpdateReconciliationDto } from './dto/update-reconciliation.dto';
import { UpsertReconciliationItemsDto } from './dto/upsert-reconciliation-items.dto';

const reconciliationInclude = {
  store: true,
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
    orderBy: {
      createdAt: 'asc',
    },
  },
} satisfies Prisma.InventoryReconciliationInclude;

type ReconciliationWithRelations = Prisma.InventoryReconciliationGetPayload<{
  include: typeof reconciliationInclude;
}>;
type DbClient = PrismaService | Prisma.TransactionClient;

@Injectable()
export class ReconciliationsService {
  constructor(private readonly prisma: PrismaService) {}

  async listReconciliations(
    user: AuthUser,
    storeId: string,
    query: ListReconciliationsQueryDto,
  ) {
    await this.assertStoreAccess(this.prisma, user.businessId, storeId);

    return this.prisma.inventoryReconciliation.findMany({
      where: {
        businessId: user.businessId,
        storeId,
        status: query.status,
        startedAt: {
          gte: query.from,
          lte: query.to,
        },
      },
      include: {
        createdByUser: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        _count: {
          select: {
            items: true,
          },
        },
      },
      orderBy: [{ startedAt: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async getReconciliation(user: AuthUser, storeId: string, reconciliationId: string) {
    await this.assertStoreAccess(this.prisma, user.businessId, storeId);
    return this.findReconciliationOrThrow(this.prisma, user.businessId, storeId, reconciliationId);
  }

  async createReconciliation(
    user: AuthUser,
    storeId: string,
    dto: CreateReconciliationDto,
  ) {
    await this.assertStoreAccess(this.prisma, user.businessId, storeId);

    return this.prisma.inventoryReconciliation.create({
      data: {
        businessId: user.businessId,
        storeId,
        createdByUserId: user.userId,
        status: ReconciliationStatus.DRAFT,
        startedAt: dto.startedAt,
        notes: dto.notes?.trim(),
      },
      include: reconciliationInclude,
    });
  }

  async updateReconciliation(
    user: AuthUser,
    storeId: string,
    reconciliationId: string,
    dto: UpdateReconciliationDto,
  ) {
    await this.assertStoreAccess(this.prisma, user.businessId, storeId);

    const reconciliation = await this.findReconciliationOrThrow(
      this.prisma,
      user.businessId,
      storeId,
      reconciliationId,
    );
    this.assertDraft(reconciliation.status);

    return this.prisma.inventoryReconciliation.update({
      where: { id: reconciliation.id },
      data: {
        startedAt: dto.startedAt,
        notes: dto.notes?.trim(),
      },
      include: reconciliationInclude,
    });
  }

  async upsertReconciliationItems(
    user: AuthUser,
    storeId: string,
    reconciliationId: string,
    dto: UpsertReconciliationItemsDto,
  ) {
    await this.assertStoreAccess(this.prisma, user.businessId, storeId);

    const uniqueInventoryItemIds = new Set(dto.items.map((item) => item.inventoryItemId));
    if (uniqueInventoryItemIds.size !== dto.items.length) {
      throw new BadRequestException('Each inventory item may appear only once in the request.');
    }

    return this.prisma.$transaction(async (tx) => {
      const reconciliation = await this.findReconciliationOrThrow(
        tx,
        user.businessId,
        storeId,
        reconciliationId,
      );
      this.assertDraft(reconciliation.status);

      const inventoryItems = await this.findInventoryItemsOrThrow(
        tx,
        user.businessId,
        Array.from(uniqueInventoryItemIds),
      );
      const validIds = new Set(inventoryItems.map((item) => item.id));

      dto.items.forEach((item) => {
        if (!validIds.has(item.inventoryItemId)) {
          throw new NotFoundException('One or more inventory items could not be found.');
        }
      });

      for (const item of dto.items) {
        await tx.reconciliationItem.upsert({
          where: {
            inventoryReconciliationId_inventoryItemId: {
              inventoryReconciliationId: reconciliation.id,
              inventoryItemId: item.inventoryItemId,
            },
          },
          create: {
            inventoryReconciliationId: reconciliation.id,
            inventoryItemId: item.inventoryItemId,
            expectedQuantity: new Prisma.Decimal(0),
            actualQuantity: toDecimal(item.actualQuantity)!,
            varianceQuantity: new Prisma.Decimal(0),
          },
          update: {
            actualQuantity: toDecimal(item.actualQuantity)!,
            expectedQuantity: new Prisma.Decimal(0),
            varianceQuantity: new Prisma.Decimal(0),
          },
        });
      }

      return tx.inventoryReconciliation.findUniqueOrThrow({
        where: { id: reconciliation.id },
        include: reconciliationInclude,
      });
    });
  }

  async postReconciliation(user: AuthUser, storeId: string, reconciliationId: string) {
    await this.assertStoreAccess(this.prisma, user.businessId, storeId);

    return this.prisma.$transaction(async (tx) => {
      const reconciliation = await this.findReconciliationOrThrow(
        tx,
        user.businessId,
        storeId,
        reconciliationId,
      );
      this.assertDraft(reconciliation.status);

      const inventoryItemIds = reconciliation.items.map((item) => item.inventoryItemId);
      const groupedExpected = inventoryItemIds.length
        ? await tx.stockMovement.groupBy({
            by: ['inventoryItemId'],
            where: {
              businessId: user.businessId,
              storeId,
              inventoryItemId: { in: inventoryItemIds },
              occurredAt: { lte: reconciliation.startedAt },
            },
            _sum: {
              quantityChange: true,
            },
          })
        : [];

      const expectedMap = new Map(
        groupedExpected.map((entry) => [
          entry.inventoryItemId,
          entry._sum.quantityChange ?? new Prisma.Decimal(0),
        ]),
      );

      for (const item of reconciliation.items) {
        const expectedQuantity = expectedMap.get(item.inventoryItemId) ?? new Prisma.Decimal(0);
        const varianceQuantity = item.actualQuantity.minus(expectedQuantity);

        await tx.reconciliationItem.update({
          where: { id: item.id },
          data: {
            expectedQuantity,
            varianceQuantity,
          },
        });

        if (!varianceQuantity.equals(0)) {
          await tx.stockMovement.create({
            data: {
              businessId: user.businessId,
              storeId,
              inventoryItemId: item.inventoryItemId,
              createdByUserId: user.userId,
              movementType: StockMovementType.INVENTORY_ADJUSTMENT,
              quantityChange: varianceQuantity,
              occurredAt: reconciliation.startedAt,
              notes: `Inventory reconciliation adjustment for session ${reconciliation.id}`,
              reconciliationItemId: item.id,
            },
          });
        }
      }

      await tx.inventoryReconciliation.update({
        where: { id: reconciliation.id },
        data: {
          status: ReconciliationStatus.POSTED,
          postedAt: new Date(),
        },
      });

      return tx.inventoryReconciliation.findUniqueOrThrow({
        where: { id: reconciliation.id },
        include: reconciliationInclude,
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

  private async findReconciliationOrThrow(
    db: DbClient,
    businessId: string,
    storeId: string,
    reconciliationId: string,
  ): Promise<ReconciliationWithRelations> {
    const reconciliation = await db.inventoryReconciliation.findFirst({
      where: {
        id: reconciliationId,
        businessId,
        storeId,
      },
      include: reconciliationInclude,
    });

    if (!reconciliation) {
      throw new NotFoundException('Reconciliation session not found.');
    }

    return reconciliation;
  }

  private async findInventoryItemsOrThrow(
    db: DbClient,
    businessId: string,
    inventoryItemIds: string[],
  ): Promise<InventoryItem[]> {
    const inventoryItems = await db.inventoryItem.findMany({
      where: {
        businessId,
        id: { in: inventoryItemIds },
        deletedAt: null,
      },
    });

    if (inventoryItems.length !== inventoryItemIds.length) {
      throw new NotFoundException('One or more inventory items could not be found.');
    }

    return inventoryItems;
  }

  private assertDraft(status: ReconciliationStatus) {
    if (status !== ReconciliationStatus.DRAFT) {
      throw new BadRequestException('Only DRAFT reconciliation sessions can be modified.');
    }
  }
}