import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthUser } from './auth-user.interface';
import { PrismaService } from '../prisma/prisma.service';

type FallbackUserRecord = {
  id: string;
  businessId: string;
  primaryStoreId: string | null;
  role: {
    name: string;
  };
};

function normalizeRoleName(roleName: string) {
  return roleName.trim().replace(/[\s-]+/g, '_').toUpperCase();
}

@Injectable()
export class UserContextGuard implements CanActivate {
  private fallbackUserPromise: Promise<AuthUser | null> | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{ user?: Partial<AuthUser> }>();
    const user = request.user;

    // Temporary development auth bypass
    if (process.env.NODE_ENV === 'development' && (!user?.userId || !user?.businessId)) {
      request.user = {
        userId: '11111111-1111-1111-1111-111111111111',
        businessId: '22222222-2222-2222-2222-222222222222',
        roleNames: ['ADMIN'],
        primaryStoreId: null,
      };
      return true;
    }

    if (!user?.userId || !user?.businessId) {
      const fallbackUser = await this.resolveFallbackUser();

      if (fallbackUser) {
        request.user = fallbackUser;
        return true;
      }
    }

    if (!user?.userId || !user.businessId) {
      throw new UnauthorizedException('Authenticated user context is required.');
    }

    request.user = {
      userId: user.userId,
      businessId: user.businessId,
      roleNames: Array.isArray(user.roleNames) ? user.roleNames : [],
      primaryStoreId: user.primaryStoreId ?? null,
    };

    return true;
  }

  private async resolveFallbackUser(): Promise<AuthUser | null> {
    if (!this.fallbackUserPromise) {
      this.fallbackUserPromise = this.loadFallbackUser();
    }

    return this.fallbackUserPromise;
  }

  private async loadFallbackUser(): Promise<AuthUser | null> {
    const configuredUserId = process.env.DEFAULT_AUTH_USER_ID?.trim();
    const configuredUserEmail = process.env.DEFAULT_AUTH_EMAIL?.trim();

    if (configuredUserId || configuredUserEmail) {
      const user = await this.prisma.user.findFirst({
        where: {
          ...(configuredUserId ? { id: configuredUserId } : {}),
          ...(configuredUserEmail ? { email: configuredUserEmail } : {}),
          isActive: true,
          deletedAt: null,
        },
        include: {
          role: {
            select: {
              name: true,
            },
          },
        },
      });

      return user ? this.mapFallbackUser(user) : null;
    }

    const users = await this.prisma.user.findMany({
      where: {
        isActive: true,
        deletedAt: null,
      },
      include: {
        role: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
      take: 2,
    });

    if (users.length !== 1) {
      return null;
    }

    return this.mapFallbackUser(users[0]);
  }

  private mapFallbackUser(user: FallbackUserRecord): AuthUser {
    return {
      userId: user.id,
      businessId: user.businessId,
      roleNames: [normalizeRoleName(user.role.name)],
      primaryStoreId: user.primaryStoreId,
    };
  }
}
