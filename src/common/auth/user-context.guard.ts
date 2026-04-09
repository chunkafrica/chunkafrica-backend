import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthUser } from './auth-user.interface';
import { PrismaService } from '../prisma/prisma.service';
import {
  getAuthContextMode,
  getConfiguredAuthUserSelector,
  getValidationWorkspaceAuthUserSelector,
  normalizeValidationWorkspaceKey,
} from './auth-context-mode';

type FallbackUserRecord = {
  id: string;
  businessId: string;
  primaryStoreId: string | null;
  role: {
    name: string;
  };
};

type AuthenticatedRequest = {
  user?: Partial<AuthUser>;
  headers?: Record<string, string | string[] | undefined>;
  cookies?: Record<string, string | undefined>;
};

const VALIDATION_WORKSPACE_HEADER = 'x-chunk-validation-workspace';
const VALIDATION_WORKSPACE_COOKIE = 'chunk.validationWorkspace';

function normalizeRoleName(roleName: string) {
  return roleName.trim().replace(/[\s-]+/g, '_').toUpperCase();
}

@Injectable()
export class UserContextGuard implements CanActivate {
  private fallbackUserPromises = new Map<string, Promise<AuthUser | null>>();

  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    if (!user?.userId || !user?.businessId) {
      const fallbackUser = await this.resolveFallbackUser(request);

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

  private async resolveFallbackUser(
    request: AuthenticatedRequest,
  ): Promise<AuthUser | null> {
    const cacheKey = this.getFallbackCacheKey(request);
    const cachedPromise = this.fallbackUserPromises.get(cacheKey);

    if (cachedPromise) {
      return cachedPromise;
    }

    const fallbackUserPromise = this.loadFallbackUser(request);
    this.fallbackUserPromises.set(cacheKey, fallbackUserPromise);

    return fallbackUserPromise;
  }

  private async loadFallbackUser(
    request: AuthenticatedRequest,
  ): Promise<AuthUser | null> {
    const configuredUserSelector = this.resolveConfiguredUserSelector(request);
    const configuredUserId = configuredUserSelector.userId;
    const configuredUserEmail = configuredUserSelector.email;

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

      if (!user && configuredUserSelector.requireExplicitSelection) {
        throw new UnauthorizedException(
          'Validation auth mode is enabled, but the configured validation user could not be found.',
        );
      }

      return user ? this.mapFallbackUser(user) : null;
    }

    if (configuredUserSelector.requireExplicitSelection) {
      throw new UnauthorizedException(
        'Validation auth mode requires VALIDATION_AUTH_USER_ID or VALIDATION_AUTH_EMAIL.',
      );
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

  private resolveConfiguredUserSelector(request: AuthenticatedRequest) {
    if (getAuthContextMode() === 'validation') {
      const requestedWorkspaceKey = normalizeValidationWorkspaceKey(
        request.headers?.[VALIDATION_WORKSPACE_HEADER] ??
          request.cookies?.[VALIDATION_WORKSPACE_COOKIE] ??
          null,
      );

      if (requestedWorkspaceKey) {
        const workspaceSelector =
          getValidationWorkspaceAuthUserSelector(requestedWorkspaceKey);

        if (workspaceSelector.userId || workspaceSelector.email) {
          return workspaceSelector;
        }

        throw new UnauthorizedException(
          `Validation auth mode is enabled, but the selected workspace "${requestedWorkspaceKey}" is not configured.`,
        );
      }
    }

    return getConfiguredAuthUserSelector();
  }

  private getFallbackCacheKey(request: AuthenticatedRequest) {
    const configuredUserSelector = this.resolveConfiguredUserSelector(request);

    return [
      configuredUserSelector.userId ?? '',
      configuredUserSelector.email ?? '',
      configuredUserSelector.requireExplicitSelection ? 'explicit' : 'default',
    ].join('|');
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
