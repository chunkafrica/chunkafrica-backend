import { Controller, Get, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/auth-user.interface';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { UserContextGuard } from '../auth/user-context.guard';
import { StoresService } from './stores.service';

@Controller('stores')
@UseGuards(UserContextGuard, RolesGuard)
export class StoresController {
  constructor(private readonly storesService: StoresService) {}

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
