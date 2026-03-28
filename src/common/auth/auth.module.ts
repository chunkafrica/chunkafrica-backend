import { Global, Module } from '@nestjs/common';
import { RolesGuard } from './roles.guard';
import { UserContextGuard } from './user-context.guard';

@Global()
@Module({
  providers: [RolesGuard, UserContextGuard],
  exports: [RolesGuard, UserContextGuard],
})
export class AuthModule {}