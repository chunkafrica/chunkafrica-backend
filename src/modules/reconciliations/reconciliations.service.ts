import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  InventoryItem,
  Prisma,
  ReconciliationStatus,
  StockMovementType,
  Store,
} from '@prisma/client';
import { AuthUser } from '../../common/auth/auth-user.interface';
import { PrismaService } from '../../common/prisma/prisma.service';
import { toDecimal } from '../../common/utils/decimal.util';
import { CreateReconciliationDto } from './dto/create-reconciliation.dto';
import { ListReconciliationsQueryDto } from './dto/list-reconciliations-query.dto';
import { MarkReconciliationReadyDto } from './dto/mark-reconciliation-ready.dto';
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
  lastEditedByUser: {
    select: {
      id: true,
      fullName: true,
      email: true,
    },
  },
  sourceStockInRecord: {
    select: {
      id: true,
      receivedAt: true,
      externalReference: true,
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
const reconciliationListInclude = {
  createdByUser: {
    select: {
      id: true,
      fullName: true,
      email: true,
    },
  },
  lastEditedByUser: {
    select: {
      id: true,
      fullName: true,
      email: true,
    },
  },
  items: {
    select: {
      id: true,
      actualQuantity: true,
      varianceQuantity: true,
    },
  },
  _count: {
    select: {
      items: true,
    },
  },
} satisfies Prisma.InventoryReconciliationInclude;

type ReconciliationListRecord = Prisma.InventoryReconciliationGetPayload<{
  include: typeof reconciliationListInclude;
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

    const reconciliations = await this.prisma.inventoryReconciliation.findMany({
      where: {
        businessId: user.businessId,
        storeId,
        status: query.status,
        startedAt: {
          gte: query.from,
          lte: query.to,
        },
      },
      include: reconciliationListInclude,
      orderBy: [{ startedAt: 'desc' }, { createdAt: 'desc' }],
    });

    return reconciliations.map((reconciliation) =>
      this.mapReconciliationListRecord(reconciliation),
    );
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
    await this.assertSourceStockInRecord(
      this.prisma,
      user.businessId,
      storeId,
      dto.sourceStockInRecordId,
    );

    return this.prisma.inventoryReconciliation.create({
      data: {
        businessId: user.businessId,
        storeId,
        createdByUserId: user.userId,
        lastEditedByUserId: user.userId,
        status: ReconciliationStatus.DRAFT,
        startedAt: dto.startedAt,
        sourceStockInRecordId: dto.sourceStockInRecordId,
        correctionIntent: dto.correctionIntent?.trim(),
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
    this.assertEditableDraft(reconciliation.status);

    return this.prisma.inventoryReconciliation.update({
      where: { id: reconciliation.id },
      data: {
        status: ReconciliationStatus.DRAFT,
        startedAt: dto.startedAt,
        lastEditedByUserId: user.userId,
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
      this.assertEditableDraft(reconciliation.status);

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
            reasonCode: item.reasonCode,
            note: item.note?.trim(),
          },
          update: {
            actualQuantity: toDecimal(item.actualQuantity)!,
            expectedQuantity: new Prisma.Decimal(0),
            varianceQuantity: new Prisma.Decimal(0),
            reasonCode: item.reasonCode,
            note: item.note?.trim(),
          },
        });
      }

      await tx.inventoryReconciliation.update({
        where: { id: reconciliation.id },
        data: {
          status: ReconciliationStatus.DRAFT,
          lastEditedByUserId: user.userId,
        },
      });

      return tx.inventoryReconciliation.findUniqueOrThrow({
        where: { id: reconciliation.id },
        include: reconciliationInclude,
      });
    });
  }

  async markReady(
    user: AuthUser,
    storeId: string,
    reconciliationId: string,
    dto: MarkReconciliationReadyDto,
  ) {
    await this.assertStoreAccess(this.prisma, user.businessId, storeId);

    return this.prisma.$transaction(async (tx) => {
      const reconciliation = await this.findReconciliationOrThrow(
        tx,
        user.businessId,
        storeId,
        reconciliationId,
      );
      this.assertEditableDraft(reconciliation.status);

      if (reconciliation.items.length === 0) {
        throw new BadRequestException('Add at least one counted line before marking a reconciliation ready.');
      }

      const nextNotes = [reconciliation.notes?.trim(), dto.note?.trim()]
        .filter((value): value is string => Boolean(value))
        .join('\n');

      return tx.inventoryReconciliation.update({
        where: { id: reconciliation.id },
        data: {
          status: ReconciliationStatus.READY,
          lastEditedByUserId: user.userId,
          notes: nextNotes || null,
        },
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
      if (reconciliation.status !== ReconciliationStatus.READY) {
        throw new BadRequestException('Only READY reconciliation sessions can be posted. Mark the draft ready after review first.');
      }

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

        if (!varianceQuantity.equals(0) && !item.reasonCode) {
          throw new BadRequestException(
            `Add a variance reason code before posting ${item.inventoryItem.name}.`,
          );
        }

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
              adjustmentReasonCode: item.reasonCode ?? undefined,
              occurredAt: reconciliation.startedAt,
              notes: item.note?.trim()
                ? `Inventory reconciliation adjustment for session ${reconciliation.id}. ${item.note.trim()}`
                : `Inventory reconciliation adjustment for session ${reconciliation.id}`,
              sourceStockInRecordId: reconciliation.sourceStockInRecordId,
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
          lastEditedByUserId: user.userId,
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

  private async assertSourceStockInRecord(
    db: DbClient,
    businessId: string,
    storeId: string,
    sourceStockInRecordId?: string,
  ) {
    if (!sourceStockInRecordId) {
      return null;
    }

    const stockInRecord = await db.stockInRecord.findFirst({
      where: {
        id: sourceStockInRecordId,
        businessId,
        storeId,
      },
      select: {
        id: true,
      },
    });

    if (!stockInRecord) {
      throw new NotFoundException('Source stock-in record not found for this store.');
    }

    return stockInRecord;
  }

  private assertEditableDraft(status: ReconciliationStatus) {
    if (status !== ReconciliationStatus.DRAFT && status !== ReconciliationStatus.READY) {
      throw new BadRequestException('Only DRAFT or READY reconciliation sessions can be modified.');
    }
  }

  private mapReconciliationListRecord(reconciliation: ReconciliationListRecord) {
    const netVarianceQuantity = reconciliation.items.reduce(
      (total, item) => total.plus(item.varianceQuantity),
      new Prisma.Decimal(0),
    );
    const absoluteVarianceQuantity = reconciliation.items.reduce(
      (total, item) => total.plus(item.varianceQuantity.abs()),
      new Prisma.Decimal(0),
    );

    return {
      id: reconciliation.id,
      businessId: reconciliation.businessId,
      storeId: reconciliation.storeId,
      createdByUserId: reconciliation.createdByUserId,
      status: reconciliation.status,
      startedAt: reconciliation.startedAt,
      postedAt: reconciliation.postedAt,
      notes: reconciliation.notes,
      createdAt: reconciliation.createdAt,
      updatedAt: reconciliation.updatedAt,
      createdByUser: reconciliation.createdByUser,
      lastEditedByUser: reconciliation.lastEditedByUser,
      _count: reconciliation._count,
      varianceSummary: {
        recordedItems: reconciliation.items.length,
        netVarianceQuantity,
        absoluteVarianceQuantity,
      },
    };
  }
}
