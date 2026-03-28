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
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { ListSuppliersQueryDto } from './dto/list-suppliers-query.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { SuppliersService } from './suppliers.service';

@Controller('suppliers')
@UseGuards(UserContextGuard, RolesGuard)
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Get()
  @Roles('OWNER', 'ADMIN', 'INVENTORY_MANAGER', 'FINANCE')
  listSuppliers(@CurrentUser() user: AuthUser, @Query() query: ListSuppliersQueryDto) {
    return this.suppliersService.listSuppliers(user, query);
  }

  @Get(':supplierId')
  @Roles('OWNER', 'ADMIN', 'INVENTORY_MANAGER', 'FINANCE')
  getSupplier(
    @CurrentUser() user: AuthUser,
    @Param('supplierId', new ParseUUIDPipe()) supplierId: string,
  ) {
    return this.suppliersService.getSupplier(user, supplierId);
  }

  @Post()
  @Roles('OWNER', 'ADMIN', 'INVENTORY_MANAGER')
  createSupplier(@CurrentUser() user: AuthUser, @Body() dto: CreateSupplierDto) {
    return this.suppliersService.createSupplier(user, dto);
  }

  @Patch(':supplierId')
  @Roles('OWNER', 'ADMIN', 'INVENTORY_MANAGER')
  updateSupplier(
    @CurrentUser() user: AuthUser,
    @Param('supplierId', new ParseUUIDPipe()) supplierId: string,
    @Body() dto: UpdateSupplierDto,
  ) {
    return this.suppliersService.updateSupplier(user, supplierId, dto);
  }

  @Delete(':supplierId')
  @Roles('OWNER', 'ADMIN')
  archiveSupplier(
    @CurrentUser() user: AuthUser,
    @Param('supplierId', new ParseUUIDPipe()) supplierId: string,
  ) {
    return this.suppliersService.archiveSupplier(user, supplierId);
  }
}