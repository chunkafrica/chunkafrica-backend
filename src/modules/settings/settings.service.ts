import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Business, Prisma, Role, User } from '@prisma/client';
import { AuthUser } from '../../common/auth/auth-user.interface';
import { PrismaService } from '../../common/prisma/prisma.service';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';

const userInclude = {
  role: {
    select: {
      id: true,
      name: true,
      description: true,
      isSystemRole: true,
    },
  },
  primaryStore: {
    select: {
      id: true,
      name: true,
      storeType: true,
      isActive: true,
    },
  },
} satisfies Prisma.UserInclude;

type UserWithRelations = Prisma.UserGetPayload<{
  include: typeof userInclude;
}>;

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview(user: AuthUser) {
    const [business, currentUser, stores, activeUsers, inactiveUsers, rolesCount] =
      await Promise.all([
        this.findBusinessOrThrow(user.businessId),
        this.findUserOrThrow(this.prisma, user.businessId, user.userId),
        this.prisma.store.findMany({
          where: {
            businessId: user.businessId,
            deletedAt: null,
          },
          select: {
            id: true,
            name: true,
            storeType: true,
            isActive: true,
          },
          orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
        }),
        this.prisma.user.count({
          where: {
            businessId: user.businessId,
            deletedAt: null,
            isActive: true,
          },
        }),
        this.prisma.user.count({
          where: {
            businessId: user.businessId,
            deletedAt: null,
            isActive: false,
          },
        }),
        this.prisma.role.count({
          where: {
            businessId: user.businessId,
            deletedAt: null,
          },
        }),
      ]);

    return {
      business: {
        id: business.id,
        name: business.name,
        legalName: business.legalName,
        email: business.email,
        phone: business.phone,
        currencyCode: business.currencyCode,
        timezone: business.timezone,
        address: business.address,
      },
      currentUser: this.mapUser(currentUser, user.userId),
      teamAccess: {
        totalUsers: activeUsers + inactiveUsers,
        activeUsers,
        inactiveUsers,
        rolesCount,
      },
      storeDefaults: {
        totalStores: stores.length,
        liveStores: stores.filter((store) => store.isActive).length,
        primaryStore: currentUser.primaryStore
          ? {
              id: currentUser.primaryStore.id,
              name: currentUser.primaryStore.name,
              storeType: currentUser.primaryStore.storeType,
              isActive: currentUser.primaryStore.isActive,
            }
          : null,
        stores: stores.map((store) => ({
          id: store.id,
          name: store.name,
          storeType: store.storeType,
          isActive: store.isActive,
        })),
        documentNumbering: {
          orders: 'SO-YYYYMMDD-########',
          invoices: 'INV-YYYYMMDD-########',
          receipts: 'RCT-YYYYMMDD-########',
        },
      },
    };
  }

  async listUsers(user: AuthUser) {
    const users = await this.prisma.user.findMany({
      where: {
        businessId: user.businessId,
        deletedAt: null,
      },
      include: userInclude,
      orderBy: [{ isActive: 'desc' }, { fullName: 'asc' }],
    });

    return users.map((entry) => this.mapUser(entry, user.userId));
  }

  async listRoles(user: AuthUser) {
    const roles = await this.prisma.role.findMany({
      where: {
        businessId: user.businessId,
        deletedAt: null,
      },
      orderBy: [{ isSystemRole: 'desc' }, { name: 'asc' }],
    });

    return roles.map((role) => this.mapRole(role));
  }

  async updateUserRole(user: AuthUser, userId: string, dto: UpdateUserRoleDto) {
    if (userId === user.userId) {
      throw new BadRequestException(
        'Change another user\'s role from this screen. Your current session role cannot be reassigned here.',
      );
    }

    await this.findRoleOrThrow(user.businessId, dto.roleId);
    await this.findUserOrThrow(this.prisma, user.businessId, userId);

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        roleId: dto.roleId,
      },
      include: userInclude,
    });

    return this.mapUser(updatedUser, user.userId);
  }

  private async findBusinessOrThrow(businessId: string): Promise<Business> {
    const business = await this.prisma.business.findFirst({
      where: {
        id: businessId,
        deletedAt: null,
      },
    });

    if (!business) {
      throw new NotFoundException('Business not found.');
    }

    return business;
  }

  private async findRoleOrThrow(businessId: string, roleId: string): Promise<Role> {
    const role = await this.prisma.role.findFirst({
      where: {
        id: roleId,
        businessId,
        deletedAt: null,
      },
    });

    if (!role) {
      throw new NotFoundException('Role not found.');
    }

    return role;
  }

  private async findUserOrThrow(
    db: PrismaService | Prisma.TransactionClient,
    businessId: string,
    userId: string,
  ): Promise<UserWithRelations> {
    const user = await db.user.findFirst({
      where: {
        id: userId,
        businessId,
        deletedAt: null,
      },
      include: userInclude,
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    return user;
  }

  private mapUser(user: UserWithRelations, currentUserId: string) {
    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      isCurrentUser: user.id === currentUserId,
      role: this.mapRole(user.role),
      primaryStore: user.primaryStore
        ? {
            id: user.primaryStore.id,
            name: user.primaryStore.name,
            storeType: user.primaryStore.storeType,
            isActive: user.primaryStore.isActive,
          }
        : null,
    };
  }

  private mapRole(role: Pick<Role, 'id' | 'name' | 'description' | 'isSystemRole'>) {
    return {
      id: role.id,
      name: role.name,
      description: role.description,
      isSystemRole: role.isSystemRole,
    };
  }
}
