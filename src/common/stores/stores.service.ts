import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma, Store } from '@prisma/client';
import { AuthUser } from '../auth/auth-user.interface';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStoreDto } from './dto/create-store.dto';
import { UpdateStoreDto } from './dto/update-store.dto';

type StoreManagementRecord = {
  id: string;
  name: string;
  code: string | null;
  storeType: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  isActive: boolean;
  createdAt: Date;
  isPrimary: boolean;
};

@Injectable()
export class StoresService {
  constructor(private readonly prisma: PrismaService) {}

  async listStores(user: AuthUser) {
    if (!user?.userId || !user.businessId) {
      throw new UnauthorizedException('Authenticated user context is required.');
    }

    const stores = await this.prisma.store.findMany({
      where: {
        businessId: user.businessId,
        deletedAt: null,
        isActive: true,
      },
      orderBy: [{ name: 'asc' }, { createdAt: 'asc' }],
    });

    return stores.map((store) => ({
      id: store.id,
      name: store.name,
      code: store.code,
      storeType: store.storeType,
      isActive: store.isActive,
      isPrimary: store.id === user.primaryStoreId,
    }));
  }

  async listManagementStores(user: AuthUser): Promise<StoreManagementRecord[]> {
    this.assertAuthenticatedUser(user);

    const stores = await this.prisma.store.findMany({
      where: {
        businessId: user.businessId,
        deletedAt: null,
      },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }, { createdAt: 'asc' }],
    });

    return stores.map((store) => this.mapManagementStore(store, user.primaryStoreId ?? null));
  }

  async getManagementStore(user: AuthUser, storeId: string): Promise<StoreManagementRecord> {
    this.assertAuthenticatedUser(user);

    const store = await this.findStoreOrThrow(user.businessId, storeId);
    return this.mapManagementStore(store, user.primaryStoreId ?? null);
  }

  async createManagementStore(user: AuthUser, dto: CreateStoreDto): Promise<StoreManagementRecord> {
    this.assertAuthenticatedUser(user);

    try {
      const store = await this.prisma.store.create({
        data: {
          businessId: user.businessId,
          name: dto.name.trim(),
          code: this.normalizeOptional(dto.code),
          storeType: dto.storeType,
          email: this.normalizeOptional(dto.email)?.toLowerCase() ?? null,
          phone: this.normalizeOptional(dto.phone),
          address: this.normalizeOptional(dto.address),
          isActive: dto.isActive ?? true,
        },
      });

      return this.mapManagementStore(store, user.primaryStoreId ?? null);
    } catch (error) {
      this.handleUniqueConstraint(error, 'A store with this name already exists.');
      throw error;
    }
  }

  async updateManagementStore(
    user: AuthUser,
    storeId: string,
    dto: UpdateStoreDto,
  ): Promise<StoreManagementRecord> {
    this.assertAuthenticatedUser(user);
    const existingStore = await this.findStoreOrThrow(user.businessId, storeId);

    try {
      const store = await this.prisma.$transaction(async (tx) => {
        const updatedStore = await tx.store.update({
          where: { id: storeId },
          data: {
            name: dto.name?.trim(),
            code: dto.code === undefined ? undefined : this.normalizeOptional(dto.code),
            storeType: dto.storeType,
            email:
              dto.email === undefined
                ? undefined
                : this.normalizeOptional(dto.email)?.toLowerCase() ?? null,
            phone: dto.phone === undefined ? undefined : this.normalizeOptional(dto.phone),
            address:
              dto.address === undefined ? undefined : this.normalizeOptional(dto.address),
            isActive: dto.isActive,
          },
        });

        if (dto.isActive === false && existingStore.isActive) {
          await tx.user.updateMany({
            where: {
              businessId: user.businessId,
              primaryStoreId: storeId,
            },
            data: {
              primaryStoreId: null,
            },
          });
        }

        return updatedStore;
      });

      const nextPrimaryStoreId =
        dto.isActive === false && user.primaryStoreId === storeId
          ? null
          : user.primaryStoreId ?? null;

      return this.mapManagementStore(store, nextPrimaryStoreId);
    } catch (error) {
      this.handleUniqueConstraint(error, 'A store with this name already exists.');
      throw error;
    }
  }

  async setPrimaryStore(user: AuthUser, storeId: string): Promise<StoreManagementRecord> {
    this.assertAuthenticatedUser(user);

    const store = await this.findStoreOrThrow(user.businessId, storeId);
    if (!store.isActive) {
      throw new BadRequestException('Only live stores can be set as primary.');
    }

    await this.prisma.user.update({
      where: {
        id: user.userId,
      },
      data: {
        primaryStoreId: storeId,
      },
    });

    return this.mapManagementStore(store, storeId);
  }

  private assertAuthenticatedUser(user: AuthUser) {
    if (!user?.userId || !user.businessId) {
      throw new UnauthorizedException('Authenticated user context is required.');
    }
  }

  private async findStoreOrThrow(businessId: string, storeId: string): Promise<Store> {
    const store = await this.prisma.store.findFirst({
      where: {
        id: storeId,
        businessId,
        deletedAt: null,
      },
    });

    if (!store) {
      throw new NotFoundException('Store not found.');
    }

    return store;
  }

  private mapManagementStore(store: Store, primaryStoreId: string | null): StoreManagementRecord {
    return {
      id: store.id,
      name: store.name,
      code: store.code,
      storeType: store.storeType,
      email: store.email,
      phone: store.phone,
      address: store.address,
      isActive: store.isActive,
      createdAt: store.createdAt,
      isPrimary: store.id === primaryStoreId,
    };
  }

  private normalizeOptional(value: string | undefined): string | null | undefined {
    if (value === undefined) {
      return undefined;
    }

    const trimmedValue = value.trim();
    return trimmedValue.length > 0 ? trimmedValue : null;
  }

  private handleUniqueConstraint(
    error: unknown,
    message: string,
  ): asserts error is Prisma.PrismaClientKnownRequestError {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(message);
    }
  }
}
