import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthUser } from './auth-user.interface';

@Injectable()
export class UserContextGuard implements CanActivate {
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
}
