import {
  Body,
  Controller,
  Delete,
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
import { CreateExpenseDto } from './dto/create-expense.dto';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { FinanceService } from './finance.service';

@Controller('stores/:storeId')
@UseGuards(UserContextGuard, RolesGuard)
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  @Get('expenses')
  @Roles('OWNER', 'ADMIN', 'FINANCE', 'INVENTORY_MANAGER')
  listExpenses(
    @CurrentUser() user: AuthUser,
    @Param('storeId', new ParseUUIDPipe()) storeId: string,
  ) {
    return this.financeService.listExpenses(user, storeId);
  }

  @Post('expenses')
  @Roles('OWNER', 'ADMIN', 'FINANCE')
  createExpense(
    @CurrentUser() user: AuthUser,
    @Param('storeId', new ParseUUIDPipe()) storeId: string,
    @Body() dto: CreateExpenseDto,
  ) {
    return this.financeService.createExpense(user, storeId, dto);
  }

  @Patch('expenses/:expenseId')
  @Roles('OWNER', 'ADMIN', 'FINANCE')
  updateExpense(
    @CurrentUser() user: AuthUser,
    @Param('storeId', new ParseUUIDPipe()) storeId: string,
    @Param('expenseId', new ParseUUIDPipe()) expenseId: string,
    @Body() dto: UpdateExpenseDto,
  ) {
    return this.financeService.updateExpense(user, storeId, expenseId, dto);
  }

  @Delete('expenses/:expenseId')
  @Roles('OWNER', 'ADMIN', 'FINANCE')
  deleteExpense(
    @CurrentUser() user: AuthUser,
    @Param('storeId', new ParseUUIDPipe()) storeId: string,
    @Param('expenseId', new ParseUUIDPipe()) expenseId: string,
  ) {
    return this.financeService.deleteExpense(user, storeId, expenseId);
  }

  @Get('invoices')
  @Roles('OWNER', 'ADMIN', 'FINANCE', 'INVENTORY_MANAGER')
  listInvoices(
    @CurrentUser() user: AuthUser,
    @Param('storeId', new ParseUUIDPipe()) storeId: string,
  ) {
    return this.financeService.listInvoices(user, storeId);
  }

  @Get('invoices/:invoiceId')
  @Roles('OWNER', 'ADMIN', 'FINANCE', 'INVENTORY_MANAGER')
  getInvoice(
    @CurrentUser() user: AuthUser,
    @Param('storeId', new ParseUUIDPipe()) storeId: string,
    @Param('invoiceId', new ParseUUIDPipe()) invoiceId: string,
  ) {
    return this.financeService.getInvoice(user, storeId, invoiceId);
  }

  @Post('invoices')
  @Roles('OWNER', 'ADMIN', 'FINANCE')
  createInvoice(
    @CurrentUser() user: AuthUser,
    @Param('storeId', new ParseUUIDPipe()) storeId: string,
    @Body() dto: CreateInvoiceDto,
  ) {
    return this.financeService.createInvoice(user, storeId, dto);
  }
}
