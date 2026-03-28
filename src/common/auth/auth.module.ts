import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RolesGuard } from './roles.guard';
import { UserContextGuard } from './user-context.guard';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [RolesGuard, UserContextGuard],
  exports: [RolesGuard, UserContextGuard],
})
export class AuthModule {}
