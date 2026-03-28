import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthUser } from '../../common/auth/auth-user.interface';
import { Roles } from '../../common/auth/roles.decorator';
import { RolesGuard } from '../../common/auth/roles.guard';
import { UserContextGuard } from '../../common/auth/user-context.guard';
import { CreateInventoryItemDto } from './dto/create-inventory-item.dto';
import { InventoryBalancesQueryDto } from './dto/inventory-balances-query.dto';
import { ListInventoryItemsQueryDto } from './dto/list-inventory-items-query.dto';
import { ListStockMovementsQueryDto } from './dto/list-stock-movements-query.dto';
import { UpdateInventoryItemDto } from './dto/update-inventory-item.dto';
import { InventoryService } from './inventory.service';

@Controller()
@UseGuards(UserContextGuard, RolesGuard)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get('inventory/items')
  @Roles('OWNER', 'ADMIN', 'INVENTORY_MANAGER', 'FINANCE')
  listInventoryItems(@CurrentUser() user: AuthUser, @Query() query: ListInventoryItemsQueryDto) {
    return this.inventoryService.listInventoryItems(user, query);
  }

  @Get('inventory/items/:inventoryItemId')
  @Roles('OWNER', 'ADMIN', 'INVENTORY_MANAGER', 'FINANCE')
  getInventoryItem(
    @CurrentUser() user: AuthUser,
    @Param('inventoryItemId', new ParseUUIDPipe()) inventoryItemId: string,
  ) {
    return this.inventoryService.getInventoryItem(user, inventoryItemId);
  }

  @Post('inventory/items')
  @Roles('OWNER', 'ADMIN', 'INVENTORY_MANAGER')
  createInventoryItem(@CurrentUser() user: AuthUser, @Body() dto: CreateInventoryItemDto) {
    return this.inventoryService.createInventoryItem(user, dto);
  }

  @Patch('inventory/items/:inventoryItemId')
  @Roles('OWNER', 'ADMIN', 'INVENTORY_MANAGER')
  updateInventoryItem(
    @CurrentUser() user: AuthUser,
    @Param('inventoryItemId', new ParseUUIDPipe()) inventoryItemId: string,
    @Body() dto: UpdateInventoryItemDto,
  ) {
    return this.inventoryService.updateInventoryItem(user, inventoryItemId, dto);
  }

  @Delete('inventory/items/:inventoryItemId')
  @Roles('OWNER', 'ADMIN')
  archiveInventoryItem(
    @CurrentUser() user: AuthUser,
    @Param('inventoryItemId', new ParseUUIDPipe()) inventoryItemId: string,
  ) {
    return this.inventoryService.archiveInventoryItem(user, inventoryItemId);
  }

  @Get('stores/:storeId/inventory/on-hand')
  @Roles('OWNER', 'ADMIN', 'INVENTORY_MANAGER', 'FINANCE')
  getOnHandInventory(
    @CurrentUser() user: AuthUser,
    @Param('storeId', new ParseUUIDPipe()) storeId: string,
    @Query() query: InventoryBalancesQueryDto,
  ) {
    return this.inventoryService.getOnHandInventory(user, storeId, query);
  }

  @Get('stores/:storeId/inventory/low-stock')
  @Roles('OWNER', 'ADMIN', 'INVENTORY_MANAGER', 'FINANCE')
  getLowStockInventory(
    @CurrentUser() user: AuthUser,
    @Param('storeId', new ParseUUIDPipe()) storeId: string,
    @Query() query: InventoryBalancesQueryDto,
  ) {
    return this.inventoryService.getLowStockInventory(user, storeId, query);
  }

  @Get('stores/:storeId/inventory/items/:inventoryItemId/movements')
  @Roles('OWNER', 'ADMIN', 'INVENTORY_MANAGER', 'FINANCE')
  listInventoryItemMovements(
    @CurrentUser() user: AuthUser,
    @Param('storeId', new ParseUUIDPipe()) storeId: string,
    @Param('inventoryItemId', new ParseUUIDPipe()) inventoryItemId: string,
    @Query() query: ListStockMovementsQueryDto,
  ) {
    return this.inventoryService.listInventoryItemMovements(user, storeId, inventoryItemId, query);
  }
}