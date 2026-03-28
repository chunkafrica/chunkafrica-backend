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
import { CreateMenuItemDto } from './dto/create-menu-item.dto';
import { ListMenuItemsQueryDto } from './dto/list-menu-items-query.dto';
import { UpdateMenuItemDto } from './dto/update-menu-item.dto';
import { RecipesService } from './recipes.service';

@Controller('menu-items')
@UseGuards(UserContextGuard, RolesGuard)
export class MenuItemsController {
  constructor(private readonly recipesService: RecipesService) {}

  @Get()
  @Roles('OWNER', 'ADMIN', 'INVENTORY_MANAGER', 'SALES_MANAGER', 'FINANCE')
  listMenuItems(@CurrentUser() user: AuthUser, @Query() query: ListMenuItemsQueryDto) {
    return this.recipesService.listMenuItems(user, query);
  }

  @Get(':menuItemId')
  @Roles('OWNER', 'ADMIN', 'INVENTORY_MANAGER', 'SALES_MANAGER', 'FINANCE')
  getMenuItem(
    @CurrentUser() user: AuthUser,
    @Param('menuItemId', new ParseUUIDPipe()) menuItemId: string,
  ) {
    return this.recipesService.getMenuItem(user, menuItemId);
  }

  @Post()
  @Roles('OWNER', 'ADMIN', 'INVENTORY_MANAGER')
  createMenuItem(@CurrentUser() user: AuthUser, @Body() dto: CreateMenuItemDto) {
    return this.recipesService.createMenuItem(user, dto);
  }

  @Patch(':menuItemId')
  @Roles('OWNER', 'ADMIN', 'INVENTORY_MANAGER')
  updateMenuItem(
    @CurrentUser() user: AuthUser,
    @Param('menuItemId', new ParseUUIDPipe()) menuItemId: string,
    @Body() dto: UpdateMenuItemDto,
  ) {
    return this.recipesService.updateMenuItem(user, menuItemId, dto);
  }

  @Delete(':menuItemId')
  @Roles('OWNER', 'ADMIN')
  archiveMenuItem(
    @CurrentUser() user: AuthUser,
    @Param('menuItemId', new ParseUUIDPipe()) menuItemId: string,
  ) {
    return this.recipesService.archiveMenuItem(user, menuItemId);
  }
}
