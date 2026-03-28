import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthUser } from '../../common/auth/auth-user.interface';
import { Roles } from '../../common/auth/roles.decorator';
import { RolesGuard } from '../../common/auth/roles.guard';
import { UserContextGuard } from '../../common/auth/user-context.guard';
import { CreateReconciliationDto } from './dto/create-reconciliation.dto';
import { ListReconciliationsQueryDto } from './dto/list-reconciliations-query.dto';
import { UpdateReconciliationDto } from './dto/update-reconciliation.dto';
import { UpsertReconciliationItemsDto } from './dto/upsert-reconciliation-items.dto';
import { ReconciliationsService } from './reconciliations.service';

@Controller('stores/:storeId/reconciliations')
@UseGuards(UserContextGuard, RolesGuard)
export class ReconciliationsController {
  constructor(private readonly reconciliationsService: ReconciliationsService) {}

  @Get()
  @Roles('OWNER', 'ADMIN', 'INVENTORY_MANAGER', 'FINANCE')
  listReconciliations(
    @CurrentUser() user: AuthUser,
    @Param('storeId', new ParseUUIDPipe()) storeId: string,
    @Query() query: ListReconciliationsQueryDto,
  ) {
    return this.reconciliationsService.listReconciliations(user, storeId, query);
  }

  @Get(':reconciliationId')
  @Roles('OWNER', 'ADMIN', 'INVENTORY_MANAGER', 'FINANCE')
  getReconciliation(
    @CurrentUser() user: AuthUser,
    @Param('storeId', new ParseUUIDPipe()) storeId: string,
    @Param('reconciliationId', new ParseUUIDPipe()) reconciliationId: string,
  ) {
    return this.reconciliationsService.getReconciliation(user, storeId, reconciliationId);
  }

  @Post()
  @Roles('OWNER', 'ADMIN', 'INVENTORY_MANAGER', 'FINANCE')
  createReconciliation(
    @CurrentUser() user: AuthUser,
    @Param('storeId', new ParseUUIDPipe()) storeId: string,
    @Body() dto: CreateReconciliationDto,
  ) {
    return this.reconciliationsService.createReconciliation(user, storeId, dto);
  }

  @Patch(':reconciliationId')
  @Roles('OWNER', 'ADMIN', 'INVENTORY_MANAGER', 'FINANCE')
  updateReconciliation(
    @CurrentUser() user: AuthUser,
    @Param('storeId', new ParseUUIDPipe()) storeId: string,
    @Param('reconciliationId', new ParseUUIDPipe()) reconciliationId: string,
    @Body() dto: UpdateReconciliationDto,
  ) {
    return this.reconciliationsService.updateReconciliation(user, storeId, reconciliationId, dto);
  }

  @Put(':reconciliationId/items')
  @Roles('OWNER', 'ADMIN', 'INVENTORY_MANAGER', 'FINANCE')
  upsertReconciliationItems(
    @CurrentUser() user: AuthUser,
    @Param('storeId', new ParseUUIDPipe()) storeId: string,
    @Param('reconciliationId', new ParseUUIDPipe()) reconciliationId: string,
    @Body() dto: UpsertReconciliationItemsDto,
  ) {
    return this.reconciliationsService.upsertReconciliationItems(user, storeId, reconciliationId, dto);
  }

  @Post(':reconciliationId/post')
  @Roles('OWNER', 'ADMIN', 'INVENTORY_MANAGER', 'FINANCE')
  postReconciliation(
    @CurrentUser() user: AuthUser,
    @Param('storeId', new ParseUUIDPipe()) storeId: string,
    @Param('reconciliationId', new ParseUUIDPipe()) reconciliationId: string,
  ) {
    return this.reconciliationsService.postReconciliation(user, storeId, reconciliationId);
  }
}