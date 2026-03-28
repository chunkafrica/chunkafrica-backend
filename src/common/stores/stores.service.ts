import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthUser } from '../auth/auth-user.interface';
import { PrismaService } from '../prisma/prisma.service';

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
}
