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
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthUser } from '../../common/auth/auth-user.interface';
import { Roles } from '../../common/auth/roles.decorator';
import { RolesGuard } from '../../common/auth/roles.guard';
import { UserContextGuard } from '../../common/auth/user-context.guard';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { CustomersService } from './customers.service';

@Controller('customers')
@UseGuards(UserContextGuard, RolesGuard)
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  @Roles('OWNER', 'ADMIN', 'FINANCE', 'INVENTORY_MANAGER')
  listCustomers(@CurrentUser() user: AuthUser) {
    return this.customersService.listCustomers(user);
  }

  @Get(':customerId')
  @Roles('OWNER', 'ADMIN', 'FINANCE', 'INVENTORY_MANAGER')
  getCustomer(
    @CurrentUser() user: AuthUser,
    @Param('customerId', new ParseUUIDPipe()) customerId: string,
  ) {
    return this.customersService.getCustomer(user, customerId);
  }

  @Post()
  @Roles('OWNER', 'ADMIN', 'FINANCE', 'INVENTORY_MANAGER')
  createCustomer(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateCustomerDto,
  ) {
    return this.customersService.createCustomer(user, dto);
  }

  @Patch(':customerId')
  @Roles('OWNER', 'ADMIN', 'FINANCE', 'INVENTORY_MANAGER')
  updateCustomer(
    @CurrentUser() user: AuthUser,
    @Param('customerId', new ParseUUIDPipe()) customerId: string,
    @Body() dto: UpdateCustomerDto,
  ) {
    return this.customersService.updateCustomer(user, customerId, dto);
  }
}
