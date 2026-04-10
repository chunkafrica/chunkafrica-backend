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
  SalesChannel,
  SalesOrderStatus,
  StockMovementType,
  Store,
} from '@prisma/client';
import { AuthUser } from '../../common/auth/auth-user.interface';
import { PrismaService } from '../../common/prisma/prisma.service';
import { toDecimal } from '../../common/utils/decimal.util';
import { CreateReceiptDto } from './dto/create-receipt.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { FulfillOrderDto } from './dto/fulfill-order.dto';
import { ListOrdersQueryDto } from './dto/list-orders-query.dto';

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

      const resolvedItems: Array<{ quantity: Prisma.Decimal; menuItem: MenuItem }> = [];
      for (const item of dto.items) {
        const menuItem = await this.resolveMenuItemForCreateOrderItem(
          tx,
          user.businessId,
          item,
        );

        resolvedItems.push({
          quantity: toDecimal(item.quantity)!,
          menuItem,
        });
      }

      const uniqueMenuItemIds = Array.from(
        new Set(resolvedItems.map((item) => item.menuItem.id)),
      );

      const activeRecipes = await tx.recipe.findMany({
        where: {
          businessId: user.businessId,
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
        if (recipeMap.has(recipe.menuItemId)) {
          throw new ConflictException(
            'A menu item has multiple active recipes. Resolve recipe activation before creating the order.',
          );
        }

        recipeMap.set(recipe.menuItemId, recipe);
      }

      const orderLineItems: ResolvedCreateOrderItem[] = [];
      for (const item of resolvedItems) {
        const recipe = recipeMap.get(item.menuItem.id);
        const fulfilledInventoryItem = recipe
          ? recipe.producedInventoryItem
          : await this.findOrCreateSalesFinishedInventoryItem(
              tx,
              user.businessId,
              item.menuItem,
            );

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

      const orderLineItemData = orderLineItems.map((item) => {
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

      const subtotal = this.sumDecimals(orderLineItemData.map((item) => item.lineTotal));
      const discount = new Prisma.Decimal(0);
      const tax = new Prisma.Decimal(0);
      const total = subtotal.minus(discount).plus(tax);
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

      return this.mapSalesOrder(order);
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

      return this.mapReceipt(receipt, paymentStatus, nextPaidTotal, order.total.minus(nextPaidTotal));
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

    await this.findOrCreateSalesFinishedInventoryItemByProductName(
      db,
      businessId,
      newProductName,
      newProductPrice,
    );

    return db.menuItem.create({
      data: {
        businessId,
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


