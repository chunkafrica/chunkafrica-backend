import { Module } from '@nestjs/common';
import { AuthModule } from '../../common/auth/auth.module';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [OrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
