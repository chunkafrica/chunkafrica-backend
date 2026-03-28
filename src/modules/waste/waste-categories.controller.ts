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
import { CreateWasteCategoryDto } from './dto/create-waste-category.dto';
import { ListWasteCategoriesQueryDto } from './dto/list-waste-categories-query.dto';
import { UpdateWasteCategoryDto } from './dto/update-waste-category.dto';
import { WasteService } from './waste.service';

@Controller('waste-categories')
@UseGuards(UserContextGuard, RolesGuard)
export class WasteCategoriesController {
  constructor(private readonly wasteService: WasteService) {}

  @Get()
  @Roles('OWNER', 'ADMIN', 'INVENTORY_MANAGER', 'PRODUCTION_MANAGER')
  listWasteCategories(@CurrentUser() user: AuthUser, @Query() query: ListWasteCategoriesQueryDto) {
    return this.wasteService.listWasteCategories(user, query);
  }

  @Get(':wasteCategoryId')
  @Roles('OWNER', 'ADMIN', 'INVENTORY_MANAGER', 'PRODUCTION_MANAGER')
  getWasteCategory(
    @CurrentUser() user: AuthUser,
    @Param('wasteCategoryId', new ParseUUIDPipe()) wasteCategoryId: string,
  ) {
    return this.wasteService.getWasteCategory(user, wasteCategoryId);
  }

  @Post()
  @Roles('OWNER', 'ADMIN', 'INVENTORY_MANAGER')
  createWasteCategory(@CurrentUser() user: AuthUser, @Body() dto: CreateWasteCategoryDto) {
    return this.wasteService.createWasteCategory(user, dto);
  }

  @Patch(':wasteCategoryId')
  @Roles('OWNER', 'ADMIN', 'INVENTORY_MANAGER')
  updateWasteCategory(
    @CurrentUser() user: AuthUser,
    @Param('wasteCategoryId', new ParseUUIDPipe()) wasteCategoryId: string,
    @Body() dto: UpdateWasteCategoryDto,
  ) {
    return this.wasteService.updateWasteCategory(user, wasteCategoryId, dto);
  }

  @Delete(':wasteCategoryId')
  @Roles('OWNER', 'ADMIN')
  archiveWasteCategory(
    @CurrentUser() user: AuthUser,
    @Param('wasteCategoryId', new ParseUUIDPipe()) wasteCategoryId: string,
  ) {
    return this.wasteService.archiveWasteCategory(user, wasteCategoryId);
  }
}