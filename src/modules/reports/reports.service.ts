import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  Prisma,
  ProductionBatchStatus,
  ReconciliationStatus,
  SalesOrderStatus,
  StockMovementType,
  Store,
} from '@prisma/client';
import { AuthUser } from '../../common/auth/auth-user.interface';
import { PrismaService } from '../../common/prisma/prisma.service';
import { DateRangeQueryDto } from './dto/date-range-query.dto';
import { InventoryReportQueryDto } from './dto/inventory-report-query.dto';

const DEFAULT_RANGE_DAYS = 30;
const MAX_RANGE_DAYS = 90;
const RECENT_LIMIT = 5;
const TOP_LIMIT = 5;

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboardOverview(user: AuthUser, storeId: string, query: DateRangeQueryDto) {
    await this.assertStoreAccess(user.businessId, storeId);
    const range = this.resolveDateRange(query);

    const [salesOrders, expenseAggregate, recentStockIns, recentProductionBatches, recentWasteLogs, recentReconciliations] =
      await Promise.all([
        this.prisma.salesOrder.findMany({
          where: this.salesOrdersWhere(user.businessId, storeId, range),
          select: {
            id: true,
            channel: true,
            total: true,
            orderedAt: true,
          },
        }),
        this.prisma.expense.aggregate({
          where: {
            businessId: user.businessId,
            storeId,
            incurredAt: { gte: range.from, lte: range.to },
          },
          _sum: { amount: true },
        }),
        this.prisma.stockInRecord.findMany({
          where: {
            businessId: user.businessId,
            storeId,
            receivedAt: { gte: range.from, lte: range.to },
          },
          include: {
            supplier: true,
            _count: { select: { items: true } },
          },
          orderBy: [{ receivedAt: 'desc' }, { createdAt: 'desc' }],
          take: RECENT_LIMIT,
        }),
        this.prisma.productionBatch.findMany({
          where: {
            businessId: user.businessId,
            storeId,
            batchDate: { gte: range.from, lte: range.to },
          },
          include: {
            menuItem: true,
            recipe: {
              select: {
                id: true,
                name: true,
              },
            },
            producedInventoryItem: true,
          },
          orderBy: [{ batchDate: 'desc' }, { createdAt: 'desc' }],
          take: RECENT_LIMIT,
        }),
        this.prisma.wasteLog.findMany({
          where: {
            businessId: user.businessId,
            storeId,
            occurredAt: { gte: range.from, lte: range.to },
          },
          include: {
            inventoryItem: true,
            wasteCategory: true,
          },
          orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
          take: RECENT_LIMIT,
        }),
        this.prisma.inventoryReconciliation.findMany({
          where: {
            businessId: user.businessId,
            storeId,
            startedAt: { gte: range.from, lte: range.to },
          },
          include: {
            _count: { select: { items: true } },
          },
          orderBy: [{ startedAt: 'desc' }, { createdAt: 'desc' }],
          take: RECENT_LIMIT,
        }),
      ]);

    const totalSales = this.sumDecimals(salesOrders.map((order) => order.total));
    const totalOrders = salesOrders.length;
    const totalExpenses = expenseAggregate._sum.amount ?? new Prisma.Decimal(0);
    const lowStockItems = (await this.getInventoryBalancesAsOf(user.businessId, storeId, range.to, false))
      .filter((item) => item.restockPoint !== null && item.onHandQuantity.lessThanOrEqualTo(item.restockPoint))
      .sort((left, right) => {
        const leftDeficit = left.restockPoint?.minus(left.onHandQuantity) ?? new Prisma.Decimal(0);
        const rightDeficit = right.restockPoint?.minus(right.onHandQuantity) ?? new Prisma.Decimal(0);
        return rightDeficit.comparedTo(leftDeficit);
      })
      .slice(0, TOP_LIMIT);

    const [topSellingMenuItems, recentVarianceAlerts] = await Promise.all([
      this.getTopSellingMenuItems(user.businessId, storeId, range, TOP_LIMIT),
      this.getVarianceAlerts(user.businessId, storeId, range, RECENT_LIMIT),
    ]);

    const normalizedRecentProductionBatches = recentProductionBatches.map((batch) => ({
      ...batch,
      menuItem: batch.menuItem ?? {
        id: batch.recipe?.id ?? batch.id,
        name: batch.recipe?.name ?? batch.producedInventoryItem.name,
      },
    }));

    return {
      range,
      totals: {
        sales: totalSales,
        orders: totalOrders,
        expenses: totalExpenses,
      },
      lowStockItems,
      recentStockIns,
      recentProductionBatches: normalizedRecentProductionBatches,
      recentWasteLogs,
      recentReconciliations,
      topSellingMenuItems,
      recentVarianceAlerts,
    };
  }

  async getSalesReport(user: AuthUser, storeId: string, query: DateRangeQueryDto) {
    await this.assertStoreAccess(user.businessId, storeId);
    const range = this.resolveDateRange(query);

    const [salesOrders, topSellingMenuItems] = await Promise.all([
      this.prisma.salesOrder.findMany({
        where: this.salesOrdersWhere(user.businessId, storeId, range),
        select: {
          id: true,
          channel: true,
          total: true,
          orderedAt: true,
          paymentStatus: true,
        },
        orderBy: [{ orderedAt: 'asc' }, { createdAt: 'asc' }],
      }),
      this.getTopSellingMenuItems(user.businessId, storeId, range, 10),
    ]);

    const totalSales = this.sumDecimals(salesOrders.map((order) => order.total));
    const totalOrders = salesOrders.length;
    const averageOrderValue = totalOrders > 0 ? totalSales.div(totalOrders) : new Prisma.Decimal(0);

    const salesByChannel = Array.from(
      salesOrders.reduce((accumulator, order) => {
        const existing = accumulator.get(order.channel) ?? {
          channel: order.channel,
          orders: 0,
          totalSales: new Prisma.Decimal(0),
        };

        existing.orders += 1;
        existing.totalSales = existing.totalSales.plus(order.total);
        accumulator.set(order.channel, existing);
        return accumulator;
      }, new Map<string, { channel: string; orders: number; totalSales: Prisma.Decimal }>()),
    )
      .map(([, value]) => value)
      .sort((left, right) => right.totalSales.comparedTo(left.totalSales));

    const dailySales = Array.from(
      salesOrders.reduce((accumulator, order) => {
        const dayKey = order.orderedAt.toISOString().slice(0, 10);
        const existing = accumulator.get(dayKey) ?? {
          date: dayKey,
          orders: 0,
          totalSales: new Prisma.Decimal(0),
        };

        existing.orders += 1;
        existing.totalSales = existing.totalSales.plus(order.total);
        accumulator.set(dayKey, existing);
        return accumulator;
      }, new Map<string, { date: string; orders: number; totalSales: Prisma.Decimal }>()),
    ).map(([, value]) => value);

    return {
      range,
      summary: {
        totalSales,
        totalOrders,
        averageOrderValue,
      },
      salesByChannel,
      dailySales,
      topSellingMenuItems,
      recentOrders: salesOrders.slice(-RECENT_LIMIT).reverse(),
    };
  }

  async getInventoryReport(user: AuthUser, storeId: string, query: InventoryReportQueryDto) {
    await this.assertStoreAccess(user.businessId, storeId);
    const asOf = query.asOf ?? new Date();
    const balances = await this.getInventoryBalancesAsOf(
      user.businessId,
      storeId,
      asOf,
      query.includeInactive ?? false,
    );

    const lowStockItems = balances.filter(
      (item) => item.restockPoint !== null && item.onHandQuantity.lessThanOrEqualTo(item.restockPoint),
    );

    const itemTypeCounts = Array.from(
      balances.reduce((accumulator, item) => {
        const current = accumulator.get(item.itemType) ?? 0;
        accumulator.set(item.itemType, current + 1);
        return accumulator;
      }, new Map<string, number>()),
    ).map(([itemType, count]) => ({ itemType, count }));

    return {
      asOf,
      summary: {
        totalItems: balances.length,
        lowStockItems: lowStockItems.length,
        itemTypeCounts,
      },
      lowStockItems,
      items: balances,
    };
  }

  async getProductionReport(user: AuthUser, storeId: string, query: DateRangeQueryDto) {
    await this.assertStoreAccess(user.businessId, storeId);
    const range = this.resolveDateRange(query);

    const batches = await this.prisma.productionBatch.findMany({
      where: {
        businessId: user.businessId,
        storeId,
        batchDate: { gte: range.from, lte: range.to },
      },
      include: {
        menuItem: true,
        recipe: {
          select: {
            id: true,
            name: true,
            yieldQuantity: true,
          },
        },
        producedInventoryItem: true,
      },
      orderBy: [{ batchDate: 'desc' }, { createdAt: 'desc' }],
    });

    const completedBatches = batches.filter((batch) => batch.status === ProductionBatchStatus.COMPLETED);
    const outputQuantity = this.sumDecimals(completedBatches.map((batch) => batch.actualOutputQuantity));

    const varianceTable = completedBatches.map((batch) => {
      const expectedOutputQuantity =
        batch.plannedOutputQuantity ?? batch.recipe?.yieldQuantity ?? new Prisma.Decimal(0);
      const outputVarianceQuantity =
        batch.outputVarianceQuantity ?? batch.actualOutputQuantity.minus(expectedOutputQuantity);
      const expectedUnitCost = batch.expectedUnitCost ?? new Prisma.Decimal(0);
      const actualUnitCost = batch.actualUnitCost ?? new Prisma.Decimal(0);

      const outputVariancePercent = expectedOutputQuantity.equals(0)
        ? null
        : outputVarianceQuantity.abs().div(expectedOutputQuantity);
      const costVariancePercent = expectedUnitCost.equals(0)
        ? null
        : actualUnitCost.minus(expectedUnitCost).abs().div(expectedUnitCost);

      const isAbnormal =
        (outputVariancePercent ? outputVariancePercent.greaterThan(0.1) : false) ||
        (costVariancePercent ? costVariancePercent.greaterThan(0.1) : false);

      return {
        id: batch.id,
        outputItemName:
          batch.menuItem?.name ?? batch.recipe?.name ?? batch.producedInventoryItem.name,
        producedInventoryItemId: batch.producedInventoryItemId,
        expectedOutputQuantity,
        actualOutputQuantity: batch.actualOutputQuantity,
        varianceQuantity: outputVarianceQuantity,
        expectedUnitCost,
        actualUnitCost,
        isAbnormal,
      };
    });

    const topProducedItems = Array.from(
      completedBatches.reduce((accumulator, batch) => {
        const key = batch.menuItemId ?? batch.recipeId;
        const displayName =
          batch.menuItem?.name ?? batch.recipe?.name ?? batch.producedInventoryItem.name;
        const existing = accumulator.get(key) ?? {
          menuItemId: key,
          menuItemName: displayName,
          producedInventoryItemId: batch.producedInventoryItemId,
          outputQuantity: new Prisma.Decimal(0),
          completedBatches: 0,
        };

        existing.outputQuantity = existing.outputQuantity.plus(batch.actualOutputQuantity);
        existing.completedBatches += 1;
        accumulator.set(key, existing);
        return accumulator;
      }, new Map<string, { menuItemId: string; menuItemName: string; producedInventoryItemId: string; outputQuantity: Prisma.Decimal; completedBatches: number }>()),
    )
      .map(([, value]) => value)
      .sort((left, right) => right.outputQuantity.comparedTo(left.outputQuantity))
      .slice(0, 10);

    return {
      range,
      summary: {
        totalBatches: batches.length,
        plannedBatches: batches.filter((batch) => batch.status === ProductionBatchStatus.PLANNED).length,
        inProgressBatches: batches.filter((batch) => batch.status === ProductionBatchStatus.IN_PROGRESS).length,
        completedBatches: completedBatches.length,
        cancelledBatches: batches.filter((batch) => batch.status === ProductionBatchStatus.CANCELLED).length,
        totalOutputQuantity: outputQuantity,
      },
      varianceTable,
      topProducedItems,
      recentBatches: batches.slice(0, 10).map((batch) => ({
        ...batch,
        menuItem: batch.menuItem ?? {
          id: batch.recipe?.id ?? batch.id,
          name: batch.recipe?.name ?? batch.producedInventoryItem.name,
        },
      })),
    };
  }

  async getWasteReport(user: AuthUser, storeId: string, query: DateRangeQueryDto) {
    await this.assertStoreAccess(user.businessId, storeId);
    const range = this.resolveDateRange(query);

    const wasteLogs = await this.prisma.wasteLog.findMany({
      where: {
        businessId: user.businessId,
        storeId,
        occurredAt: { gte: range.from, lte: range.to },
      },
      include: {
        inventoryItem: true,
        wasteCategory: true,
      },
      orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
    });

    const totalWasteQuantity = this.sumDecimals(wasteLogs.map((log) => log.quantity));
    const totalCostAtLoss = this.sumDecimals(
      wasteLogs
        .filter((log) => log.costAtLossSnapshot !== null)
        .map((log) => log.costAtLossSnapshot as Prisma.Decimal),
    );

    const byCategory = Array.from(
      wasteLogs.reduce((accumulator, log) => {
        const key = log.wasteCategoryId;
        const existing = accumulator.get(key) ?? {
          wasteCategoryId: log.wasteCategoryId,
          wasteCategoryName: log.wasteCategory.name,
          logs: 0,
          quantity: new Prisma.Decimal(0),
          costAtLoss: new Prisma.Decimal(0),
        };

        existing.logs += 1;
        existing.quantity = existing.quantity.plus(log.quantity);
        if (log.costAtLossSnapshot) {
          existing.costAtLoss = existing.costAtLoss.plus(log.costAtLossSnapshot);
        }
        accumulator.set(key, existing);
        return accumulator;
      }, new Map<string, { wasteCategoryId: string; wasteCategoryName: string; logs: number; quantity: Prisma.Decimal; costAtLoss: Prisma.Decimal }>()),
    )
      .map(([, value]) => value)
      .sort((left, right) => right.quantity.comparedTo(left.quantity));

    return {
      range,
      summary: {
        totalLogs: wasteLogs.length,
        totalWasteQuantity,
        totalCostAtLoss,
      },
      byCategory,
      recentWasteLogs: wasteLogs.slice(0, 10),
    };
  }

  async getReconciliationVarianceReport(user: AuthUser, storeId: string, query: DateRangeQueryDto) {
    await this.assertStoreAccess(user.businessId, storeId);
    const range = this.resolveDateRange(query);

    const [postedSessionsCount, adjustmentMovements] = await Promise.all([
      this.prisma.inventoryReconciliation.count({
        where: {
          businessId: user.businessId,
          storeId,
          status: ReconciliationStatus.POSTED,
          startedAt: { gte: range.from, lte: range.to },
        },
      }),
      this.prisma.stockMovement.findMany({
        where: {
          businessId: user.businessId,
          storeId,
          movementType: StockMovementType.INVENTORY_ADJUSTMENT,
          occurredAt: { gte: range.from, lte: range.to },
          reconciliationItemId: { not: null },
        },
        include: {
          reconciliationItem: {
            include: {
              inventoryItem: true,
              inventoryReconciliation: true,
            },
          },
        },
        orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
      }),
    ]);

    const positiveAdjustments = this.sumDecimals(
      adjustmentMovements
        .filter((movement) => movement.quantityChange.greaterThan(0))
        .map((movement) => movement.quantityChange),
    );

    const negativeAdjustments = this.sumDecimals(
      adjustmentMovements
        .filter((movement) => movement.quantityChange.lessThan(0))
        .map((movement) => movement.quantityChange.abs()),
    );

    const netVarianceQuantity = this.sumDecimals(
      adjustmentMovements.map((movement) => movement.quantityChange),
    );

    return {
      range,
      summary: {
        postedSessions: postedSessionsCount,
        varianceAdjustments: adjustmentMovements.length,
        positiveAdjustments,
        negativeAdjustments,
        netVarianceQuantity,
      },
      alerts: adjustmentMovements.slice(0, 20).map((movement) => ({
        id: movement.id,
        occurredAt: movement.occurredAt,
        quantityChange: movement.quantityChange,
        inventoryItem: movement.reconciliationItem?.inventoryItem,
        reconciliationSession: movement.reconciliationItem?.inventoryReconciliation,
      })),
    };
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

  private resolveDateRange(query: DateRangeQueryDto) {
    const to = query.to ?? new Date();
    const from = query.from ?? new Date(to.getTime() - DEFAULT_RANGE_DAYS * 24 * 60 * 60 * 1000);

    if (from > to) {
      throw new BadRequestException('from must be earlier than or equal to to.');
    }

    const rangeMs = to.getTime() - from.getTime();
    const maxRangeMs = MAX_RANGE_DAYS * 24 * 60 * 60 * 1000;
    if (rangeMs > maxRangeMs) {
      throw new BadRequestException(`Date range cannot exceed ${MAX_RANGE_DAYS} days.`);
    }

    return { from, to };
  }

  private salesOrdersWhere(businessId: string, storeId: string, range: { from: Date; to: Date }): Prisma.SalesOrderWhereInput {
    return {
      businessId,
      storeId,
      orderedAt: { gte: range.from, lte: range.to },
      orderStatus: { not: SalesOrderStatus.CANCELLED },
    };
  }

  private async getTopSellingMenuItems(
    businessId: string,
    storeId: string,
    range: { from: Date; to: Date },
    limit: number,
  ) {
    const salesOrderItems = await this.prisma.salesOrderItem.findMany({
      where: {
        salesOrder: {
          is: this.salesOrdersWhere(businessId, storeId, range),
        },
      },
      include: {
        menuItem: true,
      },
    });

    return Array.from(
      salesOrderItems.reduce((accumulator, item) => {
        const existing = accumulator.get(item.menuItemId) ?? {
          menuItemId: item.menuItemId,
          menuItemName: item.menuItem.name,
          quantitySold: new Prisma.Decimal(0),
          salesTotal: new Prisma.Decimal(0),
        };

        existing.quantitySold = existing.quantitySold.plus(item.quantity);
        existing.salesTotal = existing.salesTotal.plus(item.lineTotal);
        accumulator.set(item.menuItemId, existing);
        return accumulator;
      }, new Map<string, { menuItemId: string; menuItemName: string; quantitySold: Prisma.Decimal; salesTotal: Prisma.Decimal }>()),
    )
      .map(([, value]) => value)
      .sort((left, right) => {
        const quantityComparison = right.quantitySold.comparedTo(left.quantitySold);
        return quantityComparison !== 0
          ? quantityComparison
          : right.salesTotal.comparedTo(left.salesTotal);
      })
      .slice(0, limit);
  }

  private async getVarianceAlerts(
    businessId: string,
    storeId: string,
    range: { from: Date; to: Date },
    limit: number,
  ) {
    const movements = await this.prisma.stockMovement.findMany({
      where: {
        businessId,
        storeId,
        movementType: StockMovementType.INVENTORY_ADJUSTMENT,
        occurredAt: { gte: range.from, lte: range.to },
        reconciliationItemId: { not: null },
      },
      include: {
        reconciliationItem: {
          include: {
            inventoryItem: true,
            inventoryReconciliation: true,
          },
        },
      },
      orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
      take: limit,
    });

    return movements.map((movement) => ({
      id: movement.id,
      occurredAt: movement.occurredAt,
      quantityChange: movement.quantityChange,
      inventoryItem: movement.reconciliationItem?.inventoryItem,
      reconciliationSession: movement.reconciliationItem?.inventoryReconciliation,
    }));
  }

  private async getInventoryBalancesAsOf(
    businessId: string,
    storeId: string,
    asOf: Date,
    includeInactive: boolean,
  ) {
    const items = await this.prisma.inventoryItem.findMany({
      where: {
        businessId,
        deletedAt: null,
        isActive: includeInactive ? undefined : true,
      },
      orderBy: { name: 'asc' },
    });

    const groupedMovements = items.length
      ? await this.prisma.stockMovement.groupBy({
          by: ['inventoryItemId'],
          where: {
            businessId,
            storeId,
            inventoryItemId: { in: items.map((item) => item.id) },
            occurredAt: { lte: asOf },
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
        lowStock:
          item.restockPoint !== null
            ? (aggregate?._sum.quantityChange ?? new Prisma.Decimal(0)).lessThanOrEqualTo(item.restockPoint)
            : false,
      };
    });
  }

  private sumDecimals(values: Prisma.Decimal[]) {
    return values.reduce((total, value) => total.plus(value), new Prisma.Decimal(0));
  }
}
