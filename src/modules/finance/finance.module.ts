import { Module } from '@nestjs/common';
import { AuthModule } from '../../common/auth/auth.module';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { FinanceController } from './finance.controller';
import { FinanceService } from './finance.service';

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [FinanceController],
  providers: [FinanceService],
})
export class FinanceModule {}
