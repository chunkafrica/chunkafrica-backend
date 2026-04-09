import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Expense,
  InvoiceStatus,
  PaymentStatus,
  Prisma,
  Store,
  Supplier,
} from '@prisma/client';
import { AuthUser } from '../../common/auth/auth-user.interface';
import { PrismaService } from '../../common/prisma/prisma.service';
import { toDecimal } from '../../common/utils/decimal.util';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';

const expenseInclude = {
  supplier: {
    select: {
      id: true,
      name: true,
      contactName: true,
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
} satisfies Prisma.ExpenseInclude;

const invoiceInclude = {
  createdByUser: {
    select: {
      id: true,
      fullName: true,
      email: true,
    },
  },
  salesOrder: {
    include: {
      customer: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
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
        orderBy: [{ issuedAt: 'asc' }, { createdAt: 'asc' }],
      },
    },
  },
} satisfies Prisma.InvoiceInclude;

type DbClient = PrismaService | Prisma.TransactionClient;
type ExpenseWithRelations = Prisma.ExpenseGetPayload<{
  include: typeof expenseInclude;
}>;
type InvoiceWithRelations = Prisma.InvoiceGetPayload<{
  include: typeof invoiceInclude;
}>;

@Injectable()
export class FinanceService {
  constructor(private readonly prisma: PrismaService) {}

  async listExpenses(user: AuthUser, storeId: string) {
    await this.assertStoreAccess(this.prisma, user.businessId, storeId);

    return this.prisma.expense
      .findMany({
        where: {
          businessId: user.businessId,
          storeId,
        },
        include: expenseInclude,
        orderBy: [{ incurredAt: 'desc' }, { createdAt: 'desc' }],
      })
      .then((expenses) => expenses.map((expense) => this.mapExpense(expense)));
  }

  async createExpense(user: AuthUser, storeId: string, dto: CreateExpenseDto) {
    await this.assertStoreAccess(this.prisma, user.businessId, storeId);

    return this.prisma.$transaction(async (tx) => {
      await this.assertStoreAccess(tx, user.businessId, storeId);
      const supplier = await this.resolveSupplier(tx, user.businessId, dto.supplierId);

      const expense = await tx.expense.create({
        data: {
          businessId: user.businessId,
          storeId,
          supplierId: supplier?.id,
          createdByUserId: user.userId,
          category: dto.category.trim(),
          name: dto.name.trim(),
          amount: toDecimal(dto.amount)!,
          incurredAt: dto.incurredAt,
          notes: dto.notes?.trim(),
        },
        include: expenseInclude,
      });

      return this.mapExpense(expense);
    });
  }

  async updateExpense(
    user: AuthUser,
    storeId: string,
    expenseId: string,
    dto: UpdateExpenseDto,
  ) {
    await this.assertStoreAccess(this.prisma, user.businessId, storeId);
    await this.findExpenseOrThrow(this.prisma, user.businessId, storeId, expenseId);

    return this.prisma.$transaction(async (tx) => {
      await this.assertStoreAccess(tx, user.businessId, storeId);
      const supplier =
        dto.supplierId === undefined
          ? undefined
          : await this.resolveSupplier(tx, user.businessId, dto.supplierId);

      const expense = await tx.expense.update({
        where: { id: expenseId },
        data: {
          category: dto.category?.trim(),
          name: dto.name?.trim(),
          amount: dto.amount !== undefined ? toDecimal(dto.amount)! : undefined,
          incurredAt: dto.incurredAt,
          supplierId:
            dto.supplierId === undefined ? undefined : supplier?.id ?? null,
          notes: dto.notes?.trim(),
        },
        include: expenseInclude,
      });

      return this.mapExpense(expense);
    });
  }

  async deleteExpense(user: AuthUser, storeId: string, expenseId: string) {
    await this.assertStoreAccess(this.prisma, user.businessId, storeId);
    await this.findExpenseOrThrow(this.prisma, user.businessId, storeId, expenseId);

    const expense = await this.prisma.expense.delete({
      where: { id: expenseId },
      include: expenseInclude,
    });

    return this.mapExpense(expense);
  }

  async listInvoices(user: AuthUser, storeId: string) {
    await this.assertStoreAccess(this.prisma, user.businessId, storeId);

    return this.prisma.invoice
      .findMany({
        where: {
          businessId: user.businessId,
          storeId,
        },
        include: invoiceInclude,
        orderBy: [{ issueDate: 'desc' }, { createdAt: 'desc' }],
      })
      .then((invoices) => invoices.map((invoice) => this.mapInvoice(invoice)));
  }

  async getInvoice(user: AuthUser, storeId: string, invoiceId: string) {
    await this.assertStoreAccess(this.prisma, user.businessId, storeId);
    const invoice = await this.findInvoiceOrThrow(
      this.prisma,
      user.businessId,
      storeId,
      invoiceId,
    );
    return this.mapInvoice(invoice);
  }

  async createInvoice(user: AuthUser, storeId: string, dto: CreateInvoiceDto) {
    await this.assertStoreAccess(this.prisma, user.businessId, storeId);

    return this.prisma.$transaction(async (tx) => {
      await this.assertStoreAccess(tx, user.businessId, storeId);

      const order = await tx.salesOrder.findFirst({
        where: {
          id: dto.salesOrderId,
          businessId: user.businessId,
          storeId,
        },
        include: {
          receipts: true,
          invoice: true,
        },
      });

      if (!order) {
        throw new NotFoundException('Sales order not found.');
      }

      if (order.invoice) {
        throw new ConflictException('This sales order already has an invoice.');
      }

      if (order.orderStatus === 'CANCELLED') {
        throw new BadRequestException('Cancelled orders cannot be invoiced.');
      }

      if (dto.dueDate && dto.dueDate < dto.issueDate) {
        throw new BadRequestException('dueDate cannot be earlier than issueDate.');
      }

      const invoiceNumber = await this.resolveInvoiceNumber(
        tx,
        user.businessId,
        dto.issueDate,
      );

      const baseStatus = this.resolveInitialInvoiceStatus(
        order.paymentStatus,
        dto.dueDate ?? null,
      );

      const invoice = await tx.invoice.create({
        data: {
          businessId: user.businessId,
          storeId,
          salesOrderId: order.id,
          createdByUserId: user.userId,
          invoiceNumber,
          issueDate: dto.issueDate,
          dueDate: dto.dueDate,
          subtotal: order.subtotal,
          discount: order.discount,
          tax: order.tax,
          total: order.total,
          status: baseStatus,
          notes: dto.notes?.trim(),
        },
        include: invoiceInclude,
      });

      return this.mapInvoice(invoice);
    });
  }

  private async assertStoreAccess(
    db: DbClient,
    businessId: string,
    storeId: string,
  ): Promise<Store> {
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

  private async resolveSupplier(
    db: DbClient,
    businessId: string,
    supplierId: string | undefined,
  ): Promise<Supplier | null> {
    if (supplierId === undefined || supplierId === '') {
      return null;
    }

    const supplier = await db.supplier.findFirst({
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

  private async findExpenseOrThrow(
    db: DbClient,
    businessId: string,
    storeId: string,
    expenseId: string,
  ): Promise<Expense> {
    const expense = await db.expense.findFirst({
      where: {
        id: expenseId,
        businessId,
        storeId,
      },
    });

    if (!expense) {
      throw new NotFoundException('Expense not found.');
    }

    return expense;
  }

  private async findInvoiceOrThrow(
    db: DbClient,
    businessId: string,
    storeId: string,
    invoiceId: string,
  ): Promise<InvoiceWithRelations> {
    const invoice = await db.invoice.findFirst({
      where: {
        id: invoiceId,
        businessId,
        storeId,
      },
      include: invoiceInclude,
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found.');
    }

    return invoice;
  }

  private mapExpense(
    expense:
      | ExpenseWithRelations
      | (Expense & {
          supplier?: ExpenseWithRelations['supplier'] | null;
          createdByUser?: ExpenseWithRelations['createdByUser'];
        }),
  ) {
    return {
      ...expense,
      supplier: expense.supplier
        ? {
            id: expense.supplier.id,
            name: expense.supplier.name,
            contactName: expense.supplier.contactName,
            email: expense.supplier.email,
            phone: expense.supplier.phone,
          }
        : null,
    };
  }

  private mapInvoice(invoice: InvoiceWithRelations) {
    const totalPaid = invoice.salesOrder.receipts.reduce(
      (total, receipt) => total.plus(receipt.amountPaid),
      new Prisma.Decimal(0),
    );
    const outstandingBalance = invoice.total.minus(totalPaid);
    const derivedStatus = this.resolveInvoiceStatus(
      invoice.status,
      invoice.dueDate,
      invoice.salesOrder.paymentStatus,
    );

    return {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      issueDate: invoice.issueDate,
      dueDate: invoice.dueDate,
      subtotal: invoice.subtotal,
      discount: invoice.discount,
      tax: invoice.tax,
      total: invoice.total,
      status: derivedStatus,
      baseStatus: invoice.status,
      notes: invoice.notes,
      createdAt: invoice.createdAt,
      updatedAt: invoice.updatedAt,
      createdByUser: invoice.createdByUser,
      receiptsSummary: {
        count: invoice.salesOrder.receipts.length,
        totalPaid,
        outstandingBalance,
      },
      salesOrder: {
        id: invoice.salesOrder.id,
        orderNumber: invoice.salesOrder.orderNumber,
        orderedAt: invoice.salesOrder.orderedAt,
        orderStatus: invoice.salesOrder.orderStatus,
        paymentStatus: invoice.salesOrder.paymentStatus,
        total: invoice.salesOrder.total,
        customer: invoice.salesOrder.customer,
        items: invoice.salesOrder.items.map((item) => ({
          id: item.id,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          lineTotal: item.lineTotal,
          menuItem: item.menuItem,
        })),
      },
      receipts: invoice.salesOrder.receipts.map((receipt) => ({
        id: receipt.id,
        receiptNumber: receipt.receiptNumber,
        issuedAt: receipt.issuedAt,
        amountPaid: receipt.amountPaid,
        paymentMethod: receipt.paymentMethod,
        paymentReference: receipt.paymentReference,
        notes: receipt.notes,
      })),
    };
  }

  private resolveInitialInvoiceStatus(
    paymentStatus: PaymentStatus,
    dueDate: Date | null,
  ) {
    if (paymentStatus === PaymentStatus.PAID) {
      return InvoiceStatus.PAID;
    }

    if (paymentStatus === PaymentStatus.PARTIALLY_PAID) {
      return InvoiceStatus.PARTIALLY_PAID;
    }

    if (dueDate && dueDate.getTime() < Date.now()) {
      return InvoiceStatus.OVERDUE;
    }

    return InvoiceStatus.ISSUED;
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

  private async resolveInvoiceNumber(
    db: DbClient,
    businessId: string,
    issueDate: Date,
  ): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const candidate = this.generateInvoiceNumber(issueDate, attempt);
      const existing = await db.invoice.findFirst({
        where: {
          businessId,
          invoiceNumber: candidate,
        },
        select: { id: true },
      });

      if (!existing) {
        return candidate;
      }
    }

    throw new ConflictException('Could not generate a unique invoice number. Please retry.');
  }

  private generateInvoiceNumber(issueDate: Date, attempt = 0) {
    const year = issueDate.getUTCFullYear();
    const month = `${issueDate.getUTCMonth() + 1}`.padStart(2, '0');
    const day = `${issueDate.getUTCDate()}`.padStart(2, '0');
    const suffix = `${Date.now()}${attempt}${Math.floor(Math.random() * 10)}`.slice(-8);

    return `INV-${year}${month}${day}-${suffix}`;
  }
}
