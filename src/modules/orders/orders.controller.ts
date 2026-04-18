import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CancelOrderDto } from './dto/cancel-order.dto';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthUser } from '../../common/auth/auth-user.interface';
import { Roles } from '../../common/auth/roles.decorator';
import { RolesGuard } from '../../common/auth/roles.guard';
import { UserContextGuard } from '../../common/auth/user-context.guard';
import { CreateReceiptDto } from './dto/create-receipt.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { FulfillOrderDto } from './dto/fulfill-order.dto';
import { ListOrdersQueryDto } from './dto/list-orders-query.dto';
import { OrdersService } from './orders.service';
import { ReopenOrderDto } from './dto/reopen-order.dto';
import { TransitionOrderDto } from './dto/transition-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';

@Controller()
@UseGuards(UserContextGuard, RolesGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get('stores/:storeId/orders')
  @Roles('OWNER', 'ADMIN', 'FINANCE', 'INVENTORY_MANAGER')
  listOrders(
    @CurrentUser() user: AuthUser,
    @Param('storeId', new ParseUUIDPipe()) storeId: string,
    @Query() query: ListOrdersQueryDto,
  ) {
    return this.ordersService.listOrders(user, storeId, query);
  }

  @Get('stores/:storeId/orders/:orderId')
  @Roles('OWNER', 'ADMIN', 'FINANCE', 'INVENTORY_MANAGER')
  getOrder(
    @CurrentUser() user: AuthUser,
    @Param('storeId', new ParseUUIDPipe()) storeId: string,
    @Param('orderId', new ParseUUIDPipe()) orderId: string,
  ) {
    return this.ordersService.getOrder(user, storeId, orderId);
  }

  @Post('stores/:storeId/orders')
  @Roles('OWNER', 'ADMIN', 'FINANCE', 'INVENTORY_MANAGER')
  createOrder(
    @CurrentUser() user: AuthUser,
    @Param('storeId', new ParseUUIDPipe()) storeId: string,
    @Body() dto: CreateOrderDto,
  ) {
    return this.ordersService.createOrder(user, storeId, dto);
  }

  @Patch('orders/:orderId')
  @Roles('OWNER', 'ADMIN', 'FINANCE', 'INVENTORY_MANAGER')
  updateOrder(
    @CurrentUser() user: AuthUser,
    @Param('orderId', new ParseUUIDPipe()) orderId: string,
    @Body() dto: UpdateOrderDto,
  ) {
    return this.ordersService.updateOrder(user, orderId, dto);
  }

  @Post('orders/:orderId/transition')
  @Roles('OWNER', 'ADMIN', 'FINANCE', 'INVENTORY_MANAGER')
  transitionOrder(
    @CurrentUser() user: AuthUser,
    @Param('orderId', new ParseUUIDPipe()) orderId: string,
    @Body() dto: TransitionOrderDto,
  ) {
    return this.ordersService.transitionOrder(user, orderId, dto);
  }

  @Post('orders/:orderId/cancel')
  @Roles('OWNER', 'ADMIN', 'FINANCE', 'INVENTORY_MANAGER')
  cancelOrder(
    @CurrentUser() user: AuthUser,
    @Param('orderId', new ParseUUIDPipe()) orderId: string,
    @Body() dto: CancelOrderDto,
  ) {
    return this.ordersService.cancelOrder(user, orderId, dto);
  }

  @Post('orders/:orderId/reopen')
  @Roles('OWNER', 'ADMIN', 'FINANCE', 'INVENTORY_MANAGER')
  reopenOrder(
    @CurrentUser() user: AuthUser,
    @Param('orderId', new ParseUUIDPipe()) orderId: string,
    @Body() dto: ReopenOrderDto,
  ) {
    return this.ordersService.reopenOrder(user, orderId, dto);
  }

  @Post('orders/:orderId/fulfill')
  @Roles('OWNER', 'ADMIN', 'FINANCE', 'INVENTORY_MANAGER')
  fulfillOrder(
    @CurrentUser() user: AuthUser,
    @Param('orderId', new ParseUUIDPipe()) orderId: string,
    @Body() dto: FulfillOrderDto,
  ) {
    return this.ordersService.fulfillOrder(user, orderId, dto);
  }

  @Post('orders/:orderId/receipts')
  @Roles('OWNER', 'ADMIN', 'FINANCE', 'INVENTORY_MANAGER')
  createReceipt(
    @CurrentUser() user: AuthUser,
    @Param('orderId', new ParseUUIDPipe()) orderId: string,
    @Body() dto: CreateReceiptDto,
  ) {
    return this.ordersService.createReceipt(user, orderId, dto);
  }
}
