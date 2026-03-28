import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  controllers: [DashboardController, ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}