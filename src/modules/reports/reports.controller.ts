import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthUser } from '../../common/auth/auth-user.interface';
import { Roles } from '../../common/auth/roles.decorator';
import { RolesGuard } from '../../common/auth/roles.guard';
import { UserContextGuard } from '../../common/auth/user-context.guard';
import { DateRangeQueryDto } from './dto/date-range-query.dto';
import { InventoryReportQueryDto } from './dto/inventory-report-query.dto';
import { ReportsService } from './reports.service';

@Controller('stores/:storeId/reports')
@UseGuards(UserContextGuard, RolesGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('sales')
  @Roles('OWNER', 'ADMIN', 'INVENTORY_MANAGER', 'FINANCE')
  getSalesReport(
    @CurrentUser() user: AuthUser,
    @Param('storeId', new ParseUUIDPipe()) storeId: string,
    @Query() query: DateRangeQueryDto,
  ) {
    return this.reportsService.getSalesReport(user, storeId, query);
  }

  @Get('inventory')
  @Roles('OWNER', 'ADMIN', 'INVENTORY_MANAGER', 'FINANCE', 'PRODUCTION_MANAGER')
  getInventoryReport(
    @CurrentUser() user: AuthUser,
    @Param('storeId', new ParseUUIDPipe()) storeId: string,
    @Query() query: InventoryReportQueryDto,
  ) {
    return this.reportsService.getInventoryReport(user, storeId, query);
  }

  @Get('production')
  @Roles('OWNER', 'ADMIN', 'INVENTORY_MANAGER', 'FINANCE', 'PRODUCTION_MANAGER')
  getProductionReport(
    @CurrentUser() user: AuthUser,
    @Param('storeId', new ParseUUIDPipe()) storeId: string,
    @Query() query: DateRangeQueryDto,
  ) {
    return this.reportsService.getProductionReport(user, storeId, query);
  }

  @Get('waste')
  @Roles('OWNER', 'ADMIN', 'INVENTORY_MANAGER', 'FINANCE', 'PRODUCTION_MANAGER')
  getWasteReport(
    @CurrentUser() user: AuthUser,
    @Param('storeId', new ParseUUIDPipe()) storeId: string,
    @Query() query: DateRangeQueryDto,
  ) {
    return this.reportsService.getWasteReport(user, storeId, query);
  }

  @Get('reconciliation-variance')
  @Roles('OWNER', 'ADMIN', 'INVENTORY_MANAGER', 'FINANCE')
  getReconciliationVarianceReport(
    @CurrentUser() user: AuthUser,
    @Param('storeId', new ParseUUIDPipe()) storeId: string,
    @Query() query: DateRangeQueryDto,
  ) {
    return this.reportsService.getReconciliationVarianceReport(user, storeId, query);
  }
}