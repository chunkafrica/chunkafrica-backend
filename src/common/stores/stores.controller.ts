import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/auth-user.interface';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { UserContextGuard } from '../auth/user-context.guard';
import { CreateStoreDto } from './dto/create-store.dto';
import { UpdateStoreDto } from './dto/update-store.dto';
import { StoresService } from './stores.service';

@Controller('stores')
@UseGuards(UserContextGuard, RolesGuard)
export class StoresController {
  constructor(private readonly storesService: StoresService) {}

  @Get('manage')
  @Roles(
    'OWNER',
    'ADMIN',
    'INVENTORY_MANAGER',
    'FINANCE',
    'PRODUCTION_MANAGER',
    'SALES_MANAGER',
  )
  listManagementStores(@CurrentUser() user: AuthUser) {
    return this.storesService.listManagementStores(user);
  }

  @Get('manage/:storeId')
  @Roles(
    'OWNER',
    'ADMIN',
    'INVENTORY_MANAGER',
    'FINANCE',
    'PRODUCTION_MANAGER',
    'SALES_MANAGER',
  )
  getManagementStore(
    @CurrentUser() user: AuthUser,
    @Param('storeId', new ParseUUIDPipe()) storeId: string,
  ) {
    return this.storesService.getManagementStore(user, storeId);
  }

  @Post('manage')
  @Roles('OWNER', 'ADMIN', 'INVENTORY_MANAGER')
  createManagementStore(@CurrentUser() user: AuthUser, @Body() dto: CreateStoreDto) {
    return this.storesService.createManagementStore(user, dto);
  }

  @Patch('manage/:storeId')
  @Roles('OWNER', 'ADMIN', 'INVENTORY_MANAGER')
  updateManagementStore(
    @CurrentUser() user: AuthUser,
    @Param('storeId', new ParseUUIDPipe()) storeId: string,
    @Body() dto: UpdateStoreDto,
  ) {
    return this.storesService.updateManagementStore(user, storeId, dto);
  }

  @Patch('manage/:storeId/primary')
  @Roles(
    'OWNER',
    'ADMIN',
    'INVENTORY_MANAGER',
    'FINANCE',
    'PRODUCTION_MANAGER',
    'SALES_MANAGER',
  )
  setPrimaryStore(
    @CurrentUser() user: AuthUser,
    @Param('storeId', new ParseUUIDPipe()) storeId: string,
  ) {
    return this.storesService.setPrimaryStore(user, storeId);
  }

  @Get()
  @Roles(
    'OWNER',
    'ADMIN',
    'INVENTORY_MANAGER',
    'FINANCE',
    'PRODUCTION_MANAGER',
    'SALES_MANAGER',
  )
  listStores(@CurrentUser() user: AuthUser) {
    return this.storesService.listStores(user);
  }
}
