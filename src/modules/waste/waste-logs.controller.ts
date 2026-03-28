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
import { CreateWasteLogDto } from './dto/create-waste-log.dto';
import { ListWasteLogsQueryDto } from './dto/list-waste-logs-query.dto';
import { WasteService } from './waste.service';

@Controller('stores/:storeId/waste-logs')
@UseGuards(UserContextGuard, RolesGuard)
export class WasteLogsController {
  constructor(private readonly wasteService: WasteService) {}

  @Get()
  @Roles('OWNER', 'ADMIN', 'INVENTORY_MANAGER', 'PRODUCTION_MANAGER')
  listWasteLogs(
    @CurrentUser() user: AuthUser,
    @Param('storeId', new ParseUUIDPipe()) storeId: string,
    @Query() query: ListWasteLogsQueryDto,
  ) {
    return this.wasteService.listWasteLogs(user, storeId, query);
  }

  @Get(':wasteLogId')
  @Roles('OWNER', 'ADMIN', 'INVENTORY_MANAGER', 'PRODUCTION_MANAGER')
  getWasteLog(
    @CurrentUser() user: AuthUser,
    @Param('storeId', new ParseUUIDPipe()) storeId: string,
    @Param('wasteLogId', new ParseUUIDPipe()) wasteLogId: string,
  ) {
    return this.wasteService.getWasteLog(user, storeId, wasteLogId);
  }

  @Post()
  @Roles('OWNER', 'ADMIN', 'INVENTORY_MANAGER', 'PRODUCTION_MANAGER')
  createWasteLog(
    @CurrentUser() user: AuthUser,
    @Param('storeId', new ParseUUIDPipe()) storeId: string,
    @Body() dto: CreateWasteLogDto,
  ) {
    return this.wasteService.createWasteLog(user, storeId, dto);
  }
}