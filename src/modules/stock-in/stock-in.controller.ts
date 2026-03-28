import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthUser } from '../../common/auth/auth-user.interface';
import { Roles } from '../../common/auth/roles.decorator';
import { RolesGuard } from '../../common/auth/roles.guard';
import { UserContextGuard } from '../../common/auth/user-context.guard';
import { CreateStockInDto } from './dto/create-stock-in.dto';
import { ListStockInsQueryDto } from './dto/list-stock-ins-query.dto';
import { StockInService } from './stock-in.service';

@Controller('stores/:storeId/stock-ins')
@UseGuards(UserContextGuard, RolesGuard)
export class StockInController {
  constructor(private readonly stockInService: StockInService) {}

  @Get()
  @Roles('OWNER', 'ADMIN', 'INVENTORY_MANAGER', 'FINANCE')
  listStockIns(
    @CurrentUser() user: AuthUser,
    @Param('storeId', new ParseUUIDPipe()) storeId: string,
    @Query() query: ListStockInsQueryDto,
  ) {
    return this.stockInService.listStockIns(user, storeId, query);
  }

  @Get(':stockInId')
  @Roles('OWNER', 'ADMIN', 'INVENTORY_MANAGER', 'FINANCE')
  getStockIn(
    @CurrentUser() user: AuthUser,
    @Param('storeId', new ParseUUIDPipe()) storeId: string,
    @Param('stockInId', new ParseUUIDPipe()) stockInId: string,
  ) {
    return this.stockInService.getStockIn(user, storeId, stockInId);
  }

  @Post()
  @Roles('OWNER', 'ADMIN', 'INVENTORY_MANAGER')
  createStockIn(
    @CurrentUser() user: AuthUser,
    @Param('storeId', new ParseUUIDPipe()) storeId: string,
    @Body() dto: CreateStockInDto,
  ) {
    return this.stockInService.createStockIn(user, storeId, dto);
  }
}