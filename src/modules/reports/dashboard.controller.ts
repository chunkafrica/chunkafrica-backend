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
import { ReportsService } from './reports.service';

@Controller('stores/:storeId/dashboard')
@UseGuards(UserContextGuard, RolesGuard)
export class DashboardController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('overview')
  @Roles('OWNER', 'ADMIN', 'INVENTORY_MANAGER', 'FINANCE', 'PRODUCTION_MANAGER')
  getOverview(
    @CurrentUser() user: AuthUser,
    @Param('storeId', new ParseUUIDPipe()) storeId: string,
    @Query() query: DateRangeQueryDto,
  ) {
    return this.reportsService.getDashboardOverview(user, storeId, query);
  }
}