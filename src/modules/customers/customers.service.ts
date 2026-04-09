import { Injectable, NotFoundException } from '@nestjs/common';
import { Customer, InvoiceStatus, PaymentStatus, Prisma } from '@prisma/client';
import { AuthUser } from '../../common/auth/auth-user.interface';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

const customerListInclude = {
  salesOrders: {
    include: {
      store: {
        select: {
          id: true,
          name: true,
        },
      },
      receipts: {
        select: {
          id: true,
          issuedAt: true,
          amountPaid: true,
        },
        orderBy: [{ issuedAt: 'asc' }, { createdAt: 'asc' }],
      },
      invoice: {
        select: {
          id: true,
          invoiceNumber: true,
          issueDate: true,
          dueDate: true,
          total: true,
          status: true,
        },
      },
    },
    orderBy: [{ orderedAt: 'desc' }, { createdAt: 'desc' }],
  },
} satisfies Prisma.CustomerInclude;

const customerDetailInclude = {
  salesOrders: {
    include: {
      store: {
        select: {
          id: true,
          name: true,
        },
      },
      items: {
        include: {
          menuItem: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          createdAt: 'asc',
        },
      },
      receipts: {
        orderBy: [{ issuedAt: 'desc' }, { createdAt: 'desc' }],
      },
      invoice: {
        select: {
          id: true,
          invoiceNumber: true,
          issueDate: true,
          dueDate: true,
          total: true,
          status: true,
          createdAt: true,
        },
      },
    },
    orderBy: [{ orderedAt: 'desc' }, { createdAt: 'desc' }],
  },
} satisfies Prisma.CustomerInclude;

type CustomerListRecord = Prisma.CustomerGetPayload<{
  include: typeof customerListInclude;
}>;

type CustomerDetailRecord = Prisma.CustomerGetPayload<{
  include: typeof customerDetailInclude;
}>;

type CustomerOrderSummary = {
  id: string;
  orderNumber: string;
  orderedAt: Date;
  orderStatus: string;
  paymentStatus: PaymentStatus;
  total: Prisma.Decimal;
  paidAmount: Prisma.Decimal;
  outstandingBalance: Prisma.Decimal;
  store: {
    id: string;
    name: string;
  };
  invoice: {
    id: string;
    invoiceNumber: string;
    issueDate: Date;
    dueDate: Date | null;
    total: Prisma.Decimal;
    status: InvoiceStatus;
  } | null;
};

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async listCustomers(user: AuthUser) {
    const customers = await this.prisma.customer.findMany({
      where: {
        businessId: user.businessId,
        deletedAt: null,
      },
      include: customerListInclude,
      orderBy: [{ name: 'asc' }, { createdAt: 'asc' }],
    });

    return customers.map((customer) => this.mapCustomerListRecord(customer));
  }

  async getCustomer(user: AuthUser, customerId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: {
        id: customerId,
        businessId: user.businessId,
        deletedAt: null,
      },
      include: customerDetailInclude,
    });

    if (!customer) {
      throw new NotFoundException('Customer not found.');
    }

    return this.mapCustomerDetailRecord(customer);
  }

  async createCustomer(user: AuthUser, dto: CreateCustomerDto) {
    const customer = await this.prisma.customer.create({
      data: {
        businessId: user.businessId,
        name: dto.name.trim(),
        email: dto.email?.trim() || null,
        phone: dto.phone?.trim() || null,
        address: dto.address?.trim() || null,
        notes: dto.notes?.trim() || null,
        isActive: true,
      },
      include: customerDetailInclude,
    });

    return this.mapCustomerDetailRecord(customer);
  }

  async updateCustomer(user: AuthUser, customerId: string, dto: UpdateCustomerDto) {
    await this.findCustomerOrThrow(this.prisma, user.businessId, customerId);

    const customer = await this.prisma.customer.update({
      where: { id: customerId },
      data: {
        name: dto.name?.trim(),
        email: dto.email !== undefined ? dto.email.trim() || null : undefined,
        phone: dto.phone !== undefined ? dto.phone.trim() || null : undefined,
        address:
          dto.address !== undefined ? dto.address.trim() || null : undefined,
        notes: dto.notes !== undefined ? dto.notes.trim() || null : undefined,
      },
      include: customerDetailInclude,
    });

    return this.mapCustomerDetailRecord(customer);
  }

  private async findCustomerOrThrow(
    db: PrismaService | Prisma.TransactionClient,
    businessId: string,
    customerId: string,
  ): Promise<Customer> {
    const customer = await db.customer.findFirst({
      where: {
        id: customerId,
        businessId,
        deletedAt: null,
      },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found.');
    }

    return customer;
  }

  private mapCustomerListRecord(customer: CustomerListRecord) {
    const orderSummaries = customer.salesOrders.map((order) =>
      this.mapCustomerOrderSummary(order),
    );
    const latestOrder = orderSummaries[0] ?? null;
    const summary = this.buildCustomerSummary(orderSummaries);

    return {
      id: customer.id,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      address: customer.address,
      notes: customer.notes,
      isActive: customer.isActive,
      createdAt: customer.createdAt,
      updatedAt: customer.updatedAt,
      summary,
      latestOrder: latestOrder
        ? {
            id: latestOrder.id,
            orderNumber: latestOrder.orderNumber,
            orderedAt: latestOrder.orderedAt,
            total: latestOrder.total,
            paymentStatus: latestOrder.paymentStatus,
            outstandingBalance: latestOrder.outstandingBalance,
            store: latestOrder.store,
          }
        : null,
    };
  }

  private mapCustomerDetailRecord(customer: CustomerDetailRecord) {
    const orders = customer.salesOrders.map((order) => {
      const paidAmount = order.receipts.reduce(
        (total, receipt) => total.plus(receipt.amountPaid),
        new Prisma.Decimal(0),
      );
      const outstandingBalance = order.total.minus(paidAmount);
      const latestReceipt = order.receipts[0] ?? null;

      return {
        id: order.id,
        orderNumber: order.orderNumber,
        orderedAt: order.orderedAt,
        orderStatus: order.orderStatus,
        paymentStatus: order.paymentStatus,
        total: order.total,
        paidAmount,
        outstandingBalance,
        notes: order.notes,
        store: order.store,
        receiptsSummary: {
          count: order.receipts.length,
          totalPaid: paidAmount,
          outstandingBalance,
          latestIssuedAt: latestReceipt?.issuedAt ?? null,
        },
        invoice: order.invoice
          ? {
              id: order.invoice.id,
              invoiceNumber: order.invoice.invoiceNumber,
              issueDate: order.invoice.issueDate,
              dueDate: order.invoice.dueDate,
              total: order.invoice.total,
              status: this.resolveInvoiceStatus(
                order.invoice.status,
                order.invoice.dueDate,
                order.paymentStatus,
              ),
              createdAt: order.invoice.createdAt,
            }
          : null,
        items: order.items.map((item) => ({
          id: item.id,
          quantity: item.quantity,
          lineTotal: item.lineTotal,
          menuItem: item.menuItem,
        })),
        receipts: order.receipts.map((receipt) => ({
          id: receipt.id,
          receiptNumber: receipt.receiptNumber,
          issuedAt: receipt.issuedAt,
          amountPaid: receipt.amountPaid,
          paymentMethod: receipt.paymentMethod,
          paymentReference: receipt.paymentReference,
          notes: receipt.notes,
        })),
      };
    });

    return {
      id: customer.id,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      address: customer.address,
      notes: customer.notes,
      isActive: customer.isActive,
      createdAt: customer.createdAt,
      updatedAt: customer.updatedAt,
      summary: this.buildCustomerSummary(
        orders.map((order) => ({
          id: order.id,
          orderNumber: order.orderNumber,
          orderedAt: order.orderedAt,
          orderStatus: order.orderStatus,
          paymentStatus: order.paymentStatus,
          total: order.total,
          paidAmount: order.paidAmount,
          outstandingBalance: order.outstandingBalance,
          store: order.store,
          invoice: order.invoice
            ? {
                id: order.invoice.id,
                invoiceNumber: order.invoice.invoiceNumber,
                issueDate: order.invoice.issueDate,
                dueDate: order.invoice.dueDate,
                total: order.invoice.total,
                status: order.invoice.status,
              }
            : null,
        })),
      ),
      orders,
    };
  }

  private mapCustomerOrderSummary(
    order: CustomerListRecord['salesOrders'][number],
  ): CustomerOrderSummary {
    const paidAmount = order.receipts.reduce(
      (total, receipt) => total.plus(receipt.amountPaid),
      new Prisma.Decimal(0),
    );
    const outstandingBalance = order.total.minus(paidAmount);

    return {
      id: order.id,
      orderNumber: order.orderNumber,
      orderedAt: order.orderedAt,
      orderStatus: order.orderStatus,
      paymentStatus: order.paymentStatus,
      total: order.total,
      paidAmount,
      outstandingBalance,
      store: order.store,
      invoice: order.invoice
        ? {
            id: order.invoice.id,
            invoiceNumber: order.invoice.invoiceNumber,
            issueDate: order.invoice.issueDate,
            dueDate: order.invoice.dueDate,
            total: order.invoice.total,
            status: this.resolveInvoiceStatus(
              order.invoice.status,
              order.invoice.dueDate,
              order.paymentStatus,
            ),
          }
        : null,
    };
  }

  private buildCustomerSummary(orders: CustomerOrderSummary[]) {
    const totalOrders = orders.length;
    const totalOrderValue = orders.reduce(
      (total, order) => total.plus(order.total),
      new Prisma.Decimal(0),
    );
    const totalPaid = orders.reduce(
      (total, order) => total.plus(order.paidAmount),
      new Prisma.Decimal(0),
    );
    const totalOutstanding = orders.reduce(
      (total, order) => total.plus(order.outstandingBalance),
      new Prisma.Decimal(0),
    );
    const paidOrders = orders.filter(
      (order) => order.paymentStatus === PaymentStatus.PAID,
    ).length;
    const invoiceCount = orders.filter((order) => order.invoice !== null).length;
    const latestOrderAt = orders[0]?.orderedAt ?? null;

    return {
      totalOrders,
      totalOrderValue,
      totalPaid,
      totalOutstanding,
      paidOrders,
      invoiceCount,
      latestOrderAt,
    };
  }

  private resolveInvoiceStatus(
    baseStatus: InvoiceStatus,
    dueDate: Date | null,
    paymentStatus: PaymentStatus,
  ) {
    if (baseStatus === InvoiceStatus.VOID) {
      return InvoiceStatus.VOID;
    }

    if (paymentStatus === PaymentStatus.PAID) {
      return InvoiceStatus.PAID;
    }

    if (paymentStatus === PaymentStatus.PARTIALLY_PAID) {
      return InvoiceStatus.PARTIALLY_PAID;
    }

    if (baseStatus === InvoiceStatus.DRAFT) {
      return InvoiceStatus.DRAFT;
    }

    if (dueDate && dueDate.getTime() < Date.now()) {
      return InvoiceStatus.OVERDUE;
    }

    return InvoiceStatus.ISSUED;
  }
}
