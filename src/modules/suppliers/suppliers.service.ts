import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Supplier } from '@prisma/client';
import { AuthUser } from '../../common/auth/auth-user.interface';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { ListSuppliersQueryDto } from './dto/list-suppliers-query.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';

@Injectable()
export class SuppliersService {
  constructor(private readonly prisma: PrismaService) {}

  async listSuppliers(user: AuthUser, query: ListSuppliersQueryDto) {
    const where: Prisma.SupplierWhereInput = {
      businessId: user.businessId,
      deletedAt: query.includeArchived ? undefined : null,
    };

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { contactName: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
        { phone: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.supplier.findMany({
      where,
      orderBy: { name: 'asc' },
    });
  }

  async getSupplier(user: AuthUser, supplierId: string) {
    return this.findSupplierOrThrow(user.businessId, supplierId, true);
  }

  async createSupplier(user: AuthUser, dto: CreateSupplierDto) {
    try {
      return await this.prisma.supplier.create({
        data: {
          businessId: user.businessId,
          name: dto.name.trim(),
          contactName: dto.contactName?.trim(),
          email: dto.email?.trim().toLowerCase(),
          phone: dto.phone?.trim(),
          address: dto.address?.trim(),
          notes: dto.notes?.trim(),
        },
      });
    } catch (error) {
      this.handleUniqueConstraint(error, 'A supplier with this name already exists.');
      throw error;
    }
  }

  async updateSupplier(user: AuthUser, supplierId: string, dto: UpdateSupplierDto) {
    await this.findSupplierOrThrow(user.businessId, supplierId);

    try {
      return await this.prisma.supplier.update({
        where: { id: supplierId },
        data: {
          name: dto.name?.trim(),
          contactName: dto.contactName?.trim(),
          email: dto.email?.trim().toLowerCase(),
          phone: dto.phone?.trim(),
          address: dto.address?.trim(),
          notes: dto.notes?.trim(),
        },
      });
    } catch (error) {
      this.handleUniqueConstraint(error, 'A supplier with this name already exists.');
      throw error;
    }
  }

  async archiveSupplier(user: AuthUser, supplierId: string) {
    await this.findSupplierOrThrow(user.businessId, supplierId);

    return this.prisma.supplier.update({
      where: { id: supplierId },
      data: { deletedAt: new Date() },
    });
  }

  private async findSupplierOrThrow(
    businessId: string,
    supplierId: string,
    includeArchived = false,
  ): Promise<Supplier> {
    const supplier = await this.prisma.supplier.findFirst({
      where: {
        id: supplierId,
        businessId,
        deletedAt: includeArchived ? undefined : null,
      },
    });

    if (!supplier) {
      throw new NotFoundException('Supplier not found.');
    }

    return supplier;
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