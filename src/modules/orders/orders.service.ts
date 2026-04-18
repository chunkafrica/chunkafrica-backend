import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  InventoryItem,
  InventoryItemType,
  MenuItem,
  PaymentStatus,
  Prisma,
  SalesOrderControlAction,
  SalesOrderReasonCode,
  SalesChannel,
  SalesOrderStatus,
  StockMovementType,
  Store,
} from '@prisma/client';
import { AuthUser } from '../../common/auth/auth-user.interface';
import { PrismaService } from '../../common/prisma/prisma.service';
import { toDecimal } from '../../common/utils/decimal.util';
import { CancelOrderDto } from './dto/cancel-order.dto';
import { CreateReceiptDto } from './dto/create-receipt.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { FulfillOrderDto } from './dto/fulfill-order.dto';
import { ListOrdersQueryDto } from './dto/list-orders-query.dto';
import { ReopenOrderDto } from './dto/reopen-order.dto';
import { TransitionOrderDto } from './dto/transition-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';

const salesOrderInclude = {
  store: true,
  customer: {
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
    },
  },
  createdByUser: {
    select: {
      id: true,
      fullName: true,
      email: true,
    },
  },
  items: {
    include: {
      menuItem: true,
      fulfilledInventoryItem: true,
      stockMovement: true,
    },
    orderBy: {
      createdAt: 'asc',
    },
  },
  receipts: {
    include: {
      createdByUser: {
        select: {
          id: true,
          fullName: true,
          email: true,
        },
      },
    },
    orderBy: [{ issuedAt: 'asc' }, { createdAt: 'asc' }],
  },
  events: {
    include: {
      actorUser: {
        select: {
          id: true,
          fullName: true,
          email: true,
        },
      },
    },
    orderBy: [{ createdAt: 'desc' }],
  },
} satisfies Prisma.SalesOrderInclude;

const receiptInclude = {
  createdByUser: {
    select: {
      id: true,
      fullName: true,
      email: true,
    },
  },
  salesOrder: {
    select: {
      id: true,
      orderNumber: true,
      storeId: true,
      total: true,
      paymentStatus: true,
    },
  },
} satisfies Prisma.ReceiptInclude;

type SalesOrderWithRelations = Prisma.SalesOrderGetPayload<{
  include: typeof salesOrderInclude;
}>;
type ReceiptWithRelations = Prisma.ReceiptGetPayload<{
  include: typeof receiptInclude;
}>;
type DbClient = PrismaService | Prisma.TransactionClient;
type ResolvedCreateOrderItem = {
  quantity: Prisma.Decimal;
  menuItem: MenuItem;
  fulfilledInventoryItem: InventoryItem;
};

const EDITABLE_ORDER_STATUSES = new Set<SalesOrderStatus>([
  SalesOrderStatus.NEW,
  SalesOrderStatus.PREPARING,
]);

const ORDER_TRANSITION_GUARD_MAP: Record<SalesOrderStatus, SalesOrderStatus[]> = {
  [SalesOrderStatus.NEW]: [SalesOrderStatus.PREPARING],
  [SalesOrderStatus.PREPARING]: [SalesOrderStatus.READY_FOR_DELIVERY],
  [SalesOrderStatus.READY_FOR_DELIVERY]: [SalesOrderStatus.OUT_FOR_DELIVERY],
  [SalesOrderStatus.OUT_FOR_DELIVERY]: [],
  [SalesOrderStatus.DELIVERED]: [],
  [SalesOrderStatus.CANCELLED]: [],
};

const CANCEL_REASON_CODES = new Set<SalesOrderReasonCode>([
  SalesOrderReasonCode.CANCEL_CUSTOMER_REQUEST,
  SalesOrderReasonCode.CANCEL_DUPLICATE,
  SalesOrderReasonCode.CANCEL_OPERATOR_ERROR,
]);

const REOPEN_REASON_CODES = new Set<SalesOrderReasonCode>([
  SalesOrderReasonCode.REOPEN_CUSTOMER_REQUEST,
  SalesOrderReasonCode.REOPEN_OPERATOR_ERROR,
]);

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async listOrders(user: AuthUser, storeId: string, query: ListOrdersQueryDto) {
    await this.assertStoreAccess(this.prisma, user.businessId, storeId);

    return this.prisma.salesOrder
      .findMany({
        where: {
          businessId: user.businessId,
          storeId,
          channel: query.channel,
          paymentStatus: query.paymentStatus,
          orderStatus: query.orderStatus,
          orderedAt: {
            gte: query.from,
            lte: query.to,
          },
        },
        include: salesOrderInclude,
        orderBy: [{ orderedAt: 'desc' }, { createdAt: 'desc' }],
      })
      .then((orders) => orders.map((order) => this.mapSalesOrder(order)));
  }

  async getOrder(user: AuthUser, storeId: string, orderId: string) {
    await this.assertStoreAccess(this.prisma, user.businessId, storeId);
    const order = await this.findOrderOrThrow(this.prisma, user.businessId, orderId, storeId);
    return this.mapSalesOrder(order);
  }

  async createOrder(user: AuthUser, storeId: string, dto: CreateOrderDto) {
    await this.assertStoreAccess(this.prisma, user.businessId, storeId);

    return this.prisma.$transaction(async (tx) => {
      await this.assertStoreAccess(tx, user.businessId, storeId);
      const customer = await this.resolveCustomer(tx, user.businessId, dto.customerId);
      const orderLineItemData = await this.resolveOrderLineItemData(
        tx,
        user.businessId,
        dto.items,
      );
      const { subtotal, discount, tax, total } = this.computeOrderAmounts(orderLineItemData);
      const orderedAt = dto.orderedAt ?? new Date();
      const orderNumber = await this.resolveOrderNumber(tx, user.businessId, orderedAt);
      const paymentStatus = this.computePaymentStatus(new Prisma.Decimal(0), total);

      const order = await tx.salesOrder.create({
        data: {
          businessId: user.businessId,
          storeId,
          customerId: customer?.id ?? null,
          createdByUserId: user.userId,
          orderNumber,
          channel: dto.channel ?? SalesChannel.WALK_IN,
          orderStatus: SalesOrderStatus.NEW,
          paymentStatus,
          orderedAt,
          subtotal,
          discount,
          tax,
          total,
          notes: dto.notes?.trim(),
          items: {
            create: orderLineItemData,
          },
        },
        include: salesOrderInclude,
      });

      await this.recordOrderEvent(tx, {
        order,
        actorUserId: user.userId,
        action: SalesOrderControlAction.CREATED,
        reasonCode: SalesOrderReasonCode.ORDER_CREATED,
        note: dto.notes?.trim() ?? null,
        beforeSummary: undefined,
      });

      return this.mapSalesOrder(order);
    });
  }

  async updateOrder(user: AuthUser, orderId: string, dto: UpdateOrderDto) {
    return this.prisma.$transaction(async (tx) => {
      const order = await this.findOrderOrThrow(tx, user.businessId, orderId);
      const metadataOnly = this.isMetadataOnlyUpdate(dto);
      const hasReceipts = order.receipts.length > 0;
      const hasFulfillment = this.hasFulfillmentMovement(order);

      if (order.orderStatus === SalesOrderStatus.CANCELLED) {
        throw new BadRequestException('Cancelled orders cannot be edited. Reopen the order first.');
      }

      if (metadataOnly) {
        if (
          dto.reasonCode !== SalesOrderReasonCode.METADATA_CORRECTION &&
          dto.reasonCode !== SalesOrderReasonCode.COMMERCIAL_CORRECTION
        ) {
          throw new BadRequestException(
            'Metadata-only updates must use METADATA_CORRECTION or COMMERCIAL_CORRECTION.',
          );
        }
      } else {
        if (!EDITABLE_ORDER_STATUSES.has(order.orderStatus)) {
          throw new BadRequestException(
            'Only NEW or PREPARING orders can be edited before fulfillment/payment begins.',
          );
        }

        if (hasFulfillment || hasReceipts) {
          throw new BadRequestException(
            'Unsafe order edits are blocked after fulfillment movement or receipt posting. Submit a metadata-only update instead.',
          );
        }
      }

      const nextCustomerId =
        dto.customerId !== undefined
          ? (await this.resolveCustomer(tx, user.businessId, dto.customerId))?.id ?? null
          : undefined;
      const orderLineItemData = dto.items
        ? await this.resolveOrderLineItemData(tx, user.businessId, dto.items)
        : null;
      const nextAmounts = orderLineItemData
        ? this.computeOrderAmounts(orderLineItemData)
        : null;

      await tx.salesOrder.update({
        where: { id: order.id },
        data: {
          customerId: nextCustomerId,
          channel: metadataOnly ? undefined : dto.channel,
          orderedAt: metadataOnly ? undefined : dto.orderedAt,
          notes:
            dto.notes !== undefined
              ? dto.notes.trim() || null
              : undefined,
          subtotal: nextAmounts?.subtotal,
          discount: nextAmounts?.discount,
          tax: nextAmounts?.tax,
          total: nextAmounts?.total,
          paymentStatus: nextAmounts
            ? this.computePaymentStatus(
                this.sumDecimals(order.receipts.map((receipt) => receipt.amountPaid)),
                nextAmounts.total,
              )
            : undefined,
          items: orderLineItemData
            ? {
                deleteMany: {},
                create: orderLineItemData,
              }
            : undefined,
        },
        include: salesOrderInclude,
      });

      const updatedOrder = await tx.salesOrder.findUniqueOrThrow({
        where: { id: order.id },
        include: salesOrderInclude,
      });

      await this.recordOrderEvent(tx, {
        order: updatedOrder,
        actorUserId: user.userId,
        action: SalesOrderControlAction.UPDATED,
        reasonCode: dto.reasonCode,
        note: dto.note.trim(),
        beforeSummary: this.buildOrderSummarySnapshot(order),
      });

      return this.mapSalesOrder(updatedOrder);
    });
  }

  async transitionOrder(user: AuthUser, orderId: string, dto: TransitionOrderDto) {
    return this.prisma.$transaction(async (tx) => {
      const order = await this.findOrderOrThrow(tx, user.businessId, orderId);
      const allowedStatuses = ORDER_TRANSITION_GUARD_MAP[order.orderStatus] ?? [];

      if (dto.reasonCode !== SalesOrderReasonCode.STATUS_TRANSITION) {
        throw new BadRequestException('Order transitions must use STATUS_TRANSITION as the reason code.');
      }

      if (dto.nextStatus === SalesOrderStatus.CANCELLED) {
        throw new BadRequestException('Use the cancel endpoint to cancel an order.');
      }

      if (dto.nextStatus === SalesOrderStatus.DELIVERED) {
        throw new BadRequestException('Use the fulfill endpoint to mark an order as delivered.');
      }

      if (!allowedStatuses.includes(dto.nextStatus)) {
        const allowedLabel = allowedStatuses.length
          ? allowedStatuses.join(', ')
          : 'none';
        throw new BadRequestException(
          `Invalid order transition from ${order.orderStatus} to ${dto.nextStatus}. Allowed next statuses: ${allowedLabel}.`,
        );
      }

      const transitionedOrder = await tx.salesOrder.update({
        where: { id: order.id },
        data: {
          orderStatus: dto.nextStatus,
        },
        include: salesOrderInclude,
      });

      await this.recordOrderEvent(tx, {
        order: transitionedOrder,
        actorUserId: user.userId,
        action: SalesOrderControlAction.STATUS_TRANSITIONED,
        reasonCode: dto.reasonCode,
        note: dto.note.trim(),
        beforeSummary: this.buildOrderSummarySnapshot(order),
      });

      return this.mapSalesOrder(transitionedOrder);
    });
  }

  async cancelOrder(user: AuthUser, orderId: string, dto: CancelOrderDto) {
    return this.prisma.$transaction(async (tx) => {
      const order = await this.findOrderOrThrow(tx, user.businessId, orderId);

      if (!CANCEL_REASON_CODES.has(dto.reasonCode)) {
        throw new BadRequestException(
          `Cancel reason code ${dto.reasonCode} is not allowed for order cancellation.`,
        );
      }

      if (order.orderStatus === SalesOrderStatus.CANCELLED) {
        throw new BadRequestException('This order is already cancelled.');
      }

      if (this.hasFulfillmentMovement(order)) {
        throw new BadRequestException(
          'Orders with fulfillment movement cannot be cancelled. Preserve stock truth and use an explicit correction flow instead.',
        );
      }

      if (order.receipts.length > 0 && dto.settlementHandled !== true) {
        throw new BadRequestException(
          'Receipts already exist for this order. Confirm settlementHandled before cancelling instead of silently voiding the order.',
        );
      }

      const cancellationNote = order.receipts.length > 0
        ? `${dto.note.trim()} (Settlement handled: yes)`
        : dto.note.trim();

      const cancelledOrder = await tx.salesOrder.update({
        where: { id: order.id },
        data: {
          orderStatus: SalesOrderStatus.CANCELLED,
        },
        include: salesOrderInclude,
      });

      await this.recordOrderEvent(tx, {
        order: cancelledOrder,
        actorUserId: user.userId,
        action: SalesOrderControlAction.CANCELLED,
        reasonCode: dto.reasonCode,
        note: cancellationNote,
        beforeSummary: this.buildOrderSummarySnapshot(order),
      });

      return this.mapSalesOrder(cancelledOrder);
    });
  }

  async reopenOrder(user: AuthUser, orderId: string, dto: ReopenOrderDto) {
    return this.prisma.$transaction(async (tx) => {
      const order = await this.findOrderOrThrow(tx, user.businessId, orderId);

      if (!REOPEN_REASON_CODES.has(dto.reasonCode)) {
        throw new BadRequestException(
          `Reopen reason code ${dto.reasonCode} is not allowed for order reopening.`,
        );
      }

      if (order.orderStatus !== SalesOrderStatus.CANCELLED) {
        throw new BadRequestException('Only CANCELLED orders can be reopened.');
      }

      if (this.hasFulfillmentMovement(order) || order.receipts.length > 0) {
        throw new BadRequestException(
          'Cancelled orders with fulfillment movement or receipts cannot be reopened safely.',
        );
      }

      const reopenedOrder = await tx.salesOrder.update({
        where: { id: order.id },
        data: {
          orderStatus: SalesOrderStatus.NEW,
        },
        include: salesOrderInclude,
      });

      await this.recordOrderEvent(tx, {
        order: reopenedOrder,
        actorUserId: user.userId,
        action: SalesOrderControlAction.REOPENED,
        reasonCode: dto.reasonCode,
        note: dto.note.trim(),
        beforeSummary: this.buildOrderSummarySnapshot(order),
      });

      return this.mapSalesOrder(reopenedOrder);
    });
  }

  async fulfillOrder(user: AuthUser, orderId: string, dto: FulfillOrderDto) {
    return this.prisma.$transaction(async (tx) => {
      const order = await this.findOrderOrThrow(tx, user.businessId, orderId);

      if (order.orderStatus === SalesOrderStatus.CANCELLED) {
        throw new BadRequestException('Cancelled orders cannot be fulfilled.');
      }

      if (order.orderStatus === SalesOrderStatus.DELIVERED || order.items.some((item) => item.stockMovement)) {
        throw new ConflictException('This order has already been fulfilled.');
      }

      const fulfilledAt = dto.fulfilledAt ?? new Date();
      if (fulfilledAt < order.orderedAt) {
        throw new BadRequestException('fulfilledAt cannot be earlier than orderedAt.');
      }

      const requiredByInventoryItem = order.items.reduce((accumulator, item) => {
        const existing = accumulator.get(item.fulfilledInventoryItemId) ?? {
          inventoryItemId: item.fulfilledInventoryItemId,
          inventoryItemName: item.fulfilledInventoryItem.name,
          quantity: new Prisma.Decimal(0),
        };

        existing.quantity = existing.quantity.plus(item.quantity);
        accumulator.set(item.fulfilledInventoryItemId, existing);
        return accumulator;
      }, new Map<string, { inventoryItemId: string; inventoryItemName: string; quantity: Prisma.Decimal }>());

      const groupedBalances = await tx.stockMovement.groupBy({
        by: ['inventoryItemId'],
        where: {
          businessId: user.businessId,
          storeId: order.storeId,
          inventoryItemId: { in: Array.from(requiredByInventoryItem.keys()) },
          occurredAt: { lte: fulfilledAt },
        },
        _sum: {
          quantityChange: true,
        },
      });

      const balanceMap = new Map(
        groupedBalances.map((entry) => [
          entry.inventoryItemId,
          entry._sum.quantityChange ?? new Prisma.Decimal(0),
        ]),
      );

      const insufficientItems = Array.from(requiredByInventoryItem.values()).filter((line) => {
        const onHand = balanceMap.get(line.inventoryItemId) ?? new Prisma.Decimal(0);
        return line.quantity.greaterThan(onHand);
      });

      if (insufficientItems.length > 0) {
        const details = insufficientItems
          .map((line) => {
            const onHand = balanceMap.get(line.inventoryItemId) ?? new Prisma.Decimal(0);
            return `${line.inventoryItemName} (needed ${line.quantity.toString()}, on hand ${onHand.toString()})`;
          })
          .join(', ');

        throw new BadRequestException(`Insufficient finished-good stock for fulfillment: ${details}`);
      }

      for (const item of order.items) {
        await tx.stockMovement.create({
          data: {
            businessId: user.businessId,
            storeId: order.storeId,
            inventoryItemId: item.fulfilledInventoryItemId,
            createdByUserId: user.userId,
            movementType: StockMovementType.SALE,
            quantityChange: item.quantity.negated(),
            occurredAt: fulfilledAt,
            notes: dto.notes?.trim() ?? `Sale fulfillment for order ${order.orderNumber}`,
            salesOrderItemId: item.id,
          },
        });
      }

      await tx.salesOrder.update({
        where: { id: order.id },
        data: {
          orderStatus: SalesOrderStatus.DELIVERED,
          notes: dto.notes?.trim() ?? order.notes,
        },
      });

      const fulfilledOrder = await tx.salesOrder.findUniqueOrThrow({
        where: { id: order.id },
        include: salesOrderInclude,
      });

      await this.recordOrderEvent(tx, {
        order: fulfilledOrder,
        actorUserId: user.userId,
        action: SalesOrderControlAction.FULFILLED,
        reasonCode: SalesOrderReasonCode.FULFILLMENT_POSTED,
        note: dto.notes?.trim() ?? null,
        beforeSummary: this.buildOrderSummarySnapshot(order),
      });

      return this.mapSalesOrder(fulfilledOrder);
    });
  }

  async createReceipt(user: AuthUser, orderId: string, dto: CreateReceiptDto) {
    return this.prisma.$transaction(async (tx) => {
      const order = await this.findOrderOrThrow(tx, user.businessId, orderId);

      if (order.orderStatus === SalesOrderStatus.CANCELLED) {
        throw new BadRequestException('Cancelled orders cannot receive new receipts.');
      }

      const amountPaid = toDecimal(dto.amountPaid)!;
      const runningPaidTotal = this.sumDecimals(order.receipts.map((receipt) => receipt.amountPaid));
      const outstandingBalance = order.total.minus(runningPaidTotal);

      if (outstandingBalance.lessThanOrEqualTo(0)) {
        throw new BadRequestException('This order has already been fully paid.');
      }

      if (amountPaid.greaterThan(outstandingBalance)) {
        throw new BadRequestException(
          `Receipt amount exceeds outstanding balance. Outstanding balance is ${outstandingBalance.toString()}.`,
        );
      }

      const issuedAt = dto.issuedAt ?? new Date();
      const receiptNumber = await this.resolveReceiptNumber(tx, user.businessId, issuedAt);

      const receipt = await tx.receipt.create({
        data: {
          businessId: user.businessId,
          storeId: order.storeId,
          salesOrderId: order.id,
          createdByUserId: user.userId,
          receiptNumber,
          issuedAt,
          amountPaid,
          paymentMethod: dto.paymentMethod,
          paymentReference: dto.paymentReference?.trim(),
          notes: dto.notes?.trim(),
        },
        include: receiptInclude,
      });

      const nextPaidTotal = runningPaidTotal.plus(amountPaid);
      const paymentStatus = this.computePaymentStatus(nextPaidTotal, order.total);

      await tx.salesOrder.update({
        where: { id: order.id },
        data: {
          paymentStatus,
        },
      });

      const orderAfterReceipt = await tx.salesOrder.findUniqueOrThrow({
        where: { id: order.id },
        include: salesOrderInclude,
      });

      await this.recordOrderEvent(tx, {
        order: orderAfterReceipt,
        actorUserId: user.userId,
        action: SalesOrderControlAction.RECEIPT_RECORDED,
        reasonCode: SalesOrderReasonCode.RECEIPT_RECORDED,
        note: dto.notes?.trim() ?? null,
        beforeSummary: this.buildOrderSummarySnapshot(order),
      });

      return this.mapReceipt(receipt, paymentStatus, nextPaidTotal, order.total.minus(nextPaidTotal));
    });
  }

  private async resolveOrderLineItemData(
    db: DbClient,
    businessId: string,
    items: CreateOrderDto['items'],
  ) {
    const resolvedItems: Array<{ quantity: Prisma.Decimal; menuItem: MenuItem }> = [];
    for (const item of items) {
      const menuItem = await this.resolveMenuItemForCreateOrderItem(db, businessId, item);

      resolvedItems.push({
        quantity: toDecimal(item.quantity)!,
        menuItem,
      });
    }

    const uniqueMenuItemIds = Array.from(new Set(resolvedItems.map((item) => item.menuItem.id)));
    const activeRecipes = await db.recipe.findMany({
      where: {
        businessId,
        menuItemId: { in: uniqueMenuItemIds },
        isActive: true,
        deletedAt: null,
      },
      include: {
        producedInventoryItem: true,
      },
    });

    const recipeMap = new Map<string, (typeof activeRecipes)[number]>();
    for (const recipe of activeRecipes) {
      if (!recipe.menuItemId) {
        continue;
      }

      if (recipeMap.has(recipe.menuItemId)) {
        throw new ConflictException(
          'A menu item has multiple active recipes. Resolve recipe activation before creating or updating the order.',
        );
      }

      recipeMap.set(recipe.menuItemId, recipe);
    }

    const orderLineItems: ResolvedCreateOrderItem[] = [];
    for (const item of resolvedItems) {
      const recipe = recipeMap.get(item.menuItem.id);
      const fulfilledInventoryItem = recipe
        ? recipe.producedInventoryItem
        : await this.findOrCreateSalesFinishedInventoryItem(db, businessId, item.menuItem);

      if (
        fulfilledInventoryItem.deletedAt !== null ||
        !fulfilledInventoryItem.isActive ||
        fulfilledInventoryItem.itemType !== InventoryItemType.FINISHED_GOOD
      ) {
        throw new BadRequestException(
          `Menu item ${item.menuItem.name} does not resolve to an active finished-good inventory item.`,
        );
      }

      orderLineItems.push({
        quantity: item.quantity,
        menuItem: item.menuItem,
        fulfilledInventoryItem,
      });
    }

    return orderLineItems.map((item) => {
      const unitPrice = item.menuItem.defaultPrice;
      const lineTotal = unitPrice.mul(item.quantity);

      return {
        menuItemId: item.menuItem.id,
        fulfilledInventoryItemId: item.fulfilledInventoryItem.id,
        quantity: item.quantity,
        unitPrice,
        lineTotal,
      };
    });
  }

  private computeOrderAmounts(
    orderLineItemData: Array<{
      lineTotal: Prisma.Decimal;
    }>,
  ) {
    const subtotal = this.sumDecimals(orderLineItemData.map((item) => item.lineTotal));
    const discount = new Prisma.Decimal(0);
    const tax = new Prisma.Decimal(0);
    const total = subtotal.minus(discount).plus(tax);

    return { subtotal, discount, tax, total };
  }

  private isMetadataOnlyUpdate(dto: UpdateOrderDto) {
    return dto.channel === undefined && dto.orderedAt === undefined && dto.items === undefined;
  }

  private hasFulfillmentMovement(order: SalesOrderWithRelations) {
    return order.items.some((item) => item.stockMovement !== null);
  }

  private buildOrderSummarySnapshot(order: SalesOrderWithRelations): Prisma.InputJsonValue {
    const paidAmount = this.sumDecimals(order.receipts.map((receipt) => receipt.amountPaid));

    return {
      orderStatus: order.orderStatus,
      paymentStatus: order.paymentStatus,
      orderedAt: order.orderedAt.toISOString(),
      channel: order.channel,
      customerId: order.customerId,
      notes: order.notes,
      subtotal: order.subtotal.toString(),
      total: order.total.toString(),
      paidAmount: paidAmount.toString(),
      receiptCount: order.receipts.length,
      fulfillmentPosted: this.hasFulfillmentMovement(order),
      items: order.items.map((item) => ({
        salesOrderItemId: item.id,
        menuItemId: item.menuItemId,
        menuItemName: item.menuItem.name,
        fulfilledInventoryItemId: item.fulfilledInventoryItemId,
        fulfilledInventoryItemName: item.fulfilledInventoryItem.name,
        quantity: item.quantity.toString(),
        unitPrice: item.unitPrice.toString(),
        lineTotal: item.lineTotal.toString(),
      })),
    };
  }

  private async recordOrderEvent(
    db: DbClient,
    input: {
      order: SalesOrderWithRelations;
      actorUserId: string;
      action: SalesOrderControlAction;
      reasonCode: SalesOrderReasonCode;
      note: string | null;
      beforeSummary?: Prisma.InputJsonValue;
    },
  ) {
    await db.salesOrderEvent.create({
      data: {
        businessId: input.order.businessId,
        storeId: input.order.storeId,
        salesOrderId: input.order.id,
        actorUserId: input.actorUserId,
        action: input.action,
        reasonCode: input.reasonCode,
        note: input.note,
        beforeSummary: input.beforeSummary,
        afterSummary: this.buildOrderSummarySnapshot(input.order),
      },
    });
  }

  private async resolveMenuItemForCreateOrderItem(
    db: DbClient,
    businessId: string,
    item: CreateOrderDto['items'][number],
  ): Promise<MenuItem> {
    if (item.menuItemId) {
      const menuItem = await db.menuItem.findFirst({
        where: {
          id: item.menuItemId,
          businessId,
          deletedAt: null,
          isActive: true,
        },
      });

      if (!menuItem) {
        throw new NotFoundException('One or more menu items could not be found.');
      }

      return menuItem;
    }

    const newProductName = item.newProductName?.trim();
    if (!newProductName) {
      throw new BadRequestException(
        'Each order item must reference an existing product or provide a new product name.',
      );
    }

    const existingActiveMenuItem = await db.menuItem.findFirst({
      where: {
        businessId,
        deletedAt: null,
        isActive: true,
        name: {
          equals: newProductName,
          mode: 'insensitive',
        },
      },
    });

    if (existingActiveMenuItem) {
      return existingActiveMenuItem;
    }

    const existingDormantMenuItem = await db.menuItem.findFirst({
      where: {
        businessId,
        name: {
          equals: newProductName,
          mode: 'insensitive',
        },
      },
    });

    if (existingDormantMenuItem) {
      throw new BadRequestException(
        `${newProductName} already exists but is inactive or archived. Reactivate it before recording sales.`,
      );
    }

    const newProductPrice = toDecimal(item.newProductPrice);
    if (!newProductPrice) {
      throw new BadRequestException(
        `Enter a selling price to create ${newProductName}.`,
      );
    }

    const inventoryItem = await this.findOrCreateSalesFinishedInventoryItemByProductName(
      db,
      businessId,
      newProductName,
      newProductPrice,
    );

    return db.menuItem.create({
      data: {
        businessId,
        inventoryItemId: inventoryItem.id,
        name: newProductName,
        description: 'Auto-created from Sales Ops.',
        defaultPrice: newProductPrice,
        isActive: true,
      },
    });
  }

  private async findOrCreateSalesFinishedInventoryItem(
    db: DbClient,
    businessId: string,
    menuItem: MenuItem,
  ): Promise<InventoryItem> {
    return this.findOrCreateSalesFinishedInventoryItemByProductName(
      db,
      businessId,
      menuItem.name,
      menuItem.defaultPrice,
    );
  }

  private async findOrCreateSalesFinishedInventoryItemByProductName(
    db: DbClient,
    businessId: string,
    productName: string,
    defaultSellingPrice: Prisma.Decimal,
  ): Promise<InventoryItem> {
    const existingInventoryItem = await db.inventoryItem.findFirst({
      where: {
        businessId,
        deletedAt: null,
        isActive: true,
        itemType: InventoryItemType.FINISHED_GOOD,
        name: {
          equals: productName,
          mode: 'insensitive',
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    if (existingInventoryItem) {
      return existingInventoryItem;
    }

    return db.inventoryItem.create({
      data: {
        businessId,
        name: productName,
        description: 'Auto-created from Sales Ops.',
        itemType: InventoryItemType.FINISHED_GOOD,
        unitOfMeasure: 'unit',
        defaultSellingPrice,
        isActive: true,
        trackExpiry: false,
      },
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

  private async resolveCustomer(
    db: DbClient,
    businessId: string,
    customerId: string | undefined,
  ) {
    if (!customerId) {
      return null;
    }

    const customer = await db.customer.findFirst({
      where: {
        id: customerId,
        businessId,
        deletedAt: null,
        isActive: true,
      },
      select: {
        id: true,
      },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found.');
    }

    return customer;
  }

  private async findOrderOrThrow(
    db: DbClient,
    businessId: string,
    orderId: string,
    storeId?: string,
  ): Promise<SalesOrderWithRelations> {
    const order = await db.salesOrder.findFirst({
      where: {
        id: orderId,
        businessId,
        storeId,
      },
      include: salesOrderInclude,
    });

    if (!order) {
      throw new NotFoundException('Order not found.');
    }

    return order;
  }

  private computePaymentStatus(paidAmount: Prisma.Decimal, orderTotal: Prisma.Decimal): PaymentStatus {
    if (paidAmount.greaterThanOrEqualTo(orderTotal)) {
      return PaymentStatus.PAID;
    }

    if (paidAmount.greaterThan(0)) {
      return PaymentStatus.PARTIALLY_PAID;
    }

    return PaymentStatus.UNPAID;
  }

  private mapSalesOrder(order: SalesOrderWithRelations) {
    const paidAmount = this.sumDecimals(order.receipts.map((receipt) => receipt.amountPaid));
    const stockMovementTimes = order.items
      .map((item) => item.stockMovement?.occurredAt ?? null)
      .filter((value): value is Date => value !== null)
      .sort((left, right) => left.getTime() - right.getTime());
    const fulfilledAt = stockMovementTimes.length > 0 ? stockMovementTimes[stockMovementTimes.length - 1] : null;
    const hasFulfillmentMovement = this.hasFulfillmentMovement(order);
    const hasReceipts = order.receipts.length > 0;
    const editable = EDITABLE_ORDER_STATUSES.has(order.orderStatus) && !hasFulfillmentMovement && !hasReceipts;
    const validNextStatuses = ORDER_TRANSITION_GUARD_MAP[order.orderStatus] ?? [];
    const validNextActions = [
      ...(editable ? ['edit'] : []),
      ...(order.orderStatus !== SalesOrderStatus.CANCELLED && !hasFulfillmentMovement
        ? ['cancel']
        : []),
      ...(order.orderStatus === SalesOrderStatus.CANCELLED && !hasFulfillmentMovement && !hasReceipts
        ? ['reopen']
        : []),
      ...(order.orderStatus !== SalesOrderStatus.CANCELLED &&
      order.orderStatus !== SalesOrderStatus.DELIVERED &&
      !hasFulfillmentMovement
        ? ['fulfill']
        : []),
      ...(order.orderStatus !== SalesOrderStatus.CANCELLED &&
      paidAmount.lessThan(order.total)
        ? ['record_payment']
        : []),
      ...validNextStatuses.map((status) => `transition:${status}`),
    ];

    return {
      ...order,
      customer: order.customer
        ? {
            id: order.customer.id,
            name: order.customer.name,
            email: order.customer.email,
            phone: order.customer.phone,
          }
        : null,
      paidAmount,
      outstandingBalance: order.total.minus(paidAmount),
      receiptsSummary: {
        count: order.receipts.length,
        totalPaid: paidAmount,
        outstandingBalance: order.total.minus(paidAmount),
      },
      fulfillmentState: {
        isFulfilled: order.orderStatus === SalesOrderStatus.DELIVERED,
        fulfilledAt,
        saleMovementCount: order.items.filter((item) => item.stockMovement !== null).length,
      },
      controlState: {
        canEdit: editable,
        canCancel: order.orderStatus !== SalesOrderStatus.CANCELLED && !hasFulfillmentMovement,
        canReopen:
          order.orderStatus === SalesOrderStatus.CANCELLED &&
          !hasFulfillmentMovement &&
          !hasReceipts,
        canFulfill:
          order.orderStatus !== SalesOrderStatus.CANCELLED &&
          order.orderStatus !== SalesOrderStatus.DELIVERED &&
          !hasFulfillmentMovement,
        canRecordPayment:
          order.orderStatus !== SalesOrderStatus.CANCELLED && paidAmount.lessThan(order.total),
        settlementRequiredBeforeCancel: hasReceipts,
        validNextStatuses,
        validNextActions,
      },
      auditTrail: order.events.map((event) => ({
        id: event.id,
        action: event.action,
        reasonCode: event.reasonCode,
        note: event.note,
        createdAt: event.createdAt,
        actorUser: event.actorUser,
        beforeSummary: event.beforeSummary,
        afterSummary: event.afterSummary,
      })),
    };
  }

  private mapReceipt(
    receipt: ReceiptWithRelations,
    paymentStatus: PaymentStatus,
    runningPaidTotal: Prisma.Decimal,
    outstandingBalance: Prisma.Decimal,
  ) {
    return {
      ...receipt,
      paymentStatus,
      runningPaidTotal,
      outstandingBalance,
    };
  }

  private async resolveOrderNumber(
    db: DbClient,
    businessId: string,
    orderedAt: Date,
  ): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const candidate = this.generateOrderNumber(orderedAt, attempt);
      const existing = await db.salesOrder.findFirst({
        where: {
          businessId,
          orderNumber: candidate,
        },
        select: { id: true },
      });

      if (!existing) {
        return candidate;
      }
    }

    throw new ConflictException('Could not generate a unique order number. Please retry.');
  }

  private async resolveReceiptNumber(
    db: DbClient,
    businessId: string,
    issuedAt: Date,
  ): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const candidate = this.generateReceiptNumber(issuedAt, attempt);
      const existing = await db.receipt.findFirst({
        where: {
          businessId,
          receiptNumber: candidate,
        },
        select: { id: true },
      });

      if (!existing) {
        return candidate;
      }
    }

    throw new ConflictException('Could not generate a unique receipt number. Please retry.');
  }

  private generateOrderNumber(orderedAt: Date, attempt = 0): string {
    const year = orderedAt.getUTCFullYear();
    const month = `${orderedAt.getUTCMonth() + 1}`.padStart(2, '0');
    const day = `${orderedAt.getUTCDate()}`.padStart(2, '0');
    const suffix = `${Date.now()}${attempt}${Math.floor(Math.random() * 10)}`.slice(-8);

    return `SO-${year}${month}${day}-${suffix}`;
  }

  private generateReceiptNumber(issuedAt: Date, attempt = 0): string {
    const year = issuedAt.getUTCFullYear();
    const month = `${issuedAt.getUTCMonth() + 1}`.padStart(2, '0');
    const day = `${issuedAt.getUTCDate()}`.padStart(2, '0');
    const suffix = `${Date.now()}${attempt}${Math.floor(Math.random() * 10)}`.slice(-8);

    return `RCT-${year}${month}${day}-${suffix}`;
  }

  private sumDecimals(values: Prisma.Decimal[]) {
    return values.reduce((total, value) => total.plus(value), new Prisma.Decimal(0));
  }
}


