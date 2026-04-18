import {
  Body,
  Controller,
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
import { CompleteProductionBatchDto } from './dto/complete-production-batch.dto';
import { CorrectProductionBatchDto } from './dto/correct-production-batch.dto';
import { CorrectProductionVarianceReasonDto } from './dto/correct-production-variance-reason.dto';
import { CreateProductionBatchDto } from './dto/create-production-batch.dto';
import { ListProductionBatchesQueryDto } from './dto/list-production-batches-query.dto';
import { UpdateProductionBatchDto } from './dto/update-production-batch.dto';
import { ProductionBatchesService } from './production-batches.service';

@Controller('stores/:storeId/production-batches')
@UseGuards(UserContextGuard, RolesGuard)
export class ProductionBatchesController {
  constructor(private readonly productionBatchesService: ProductionBatchesService) {}

  @Get()
  @Roles('OWNER', 'ADMIN', 'INVENTORY_MANAGER', 'PRODUCTION_MANAGER')
  listProductionBatches(
    @CurrentUser() user: AuthUser,
    @Param('storeId', new ParseUUIDPipe()) storeId: string,
    @Query() query: ListProductionBatchesQueryDto,
  ) {
    return this.productionBatchesService.listProductionBatches(user, storeId, query);
  }

  @Get(':batchId')
  @Roles('OWNER', 'ADMIN', 'INVENTORY_MANAGER', 'PRODUCTION_MANAGER')
  getProductionBatch(
    @CurrentUser() user: AuthUser,
    @Param('storeId', new ParseUUIDPipe()) storeId: string,
    @Param('batchId', new ParseUUIDPipe()) batchId: string,
  ) {
    return this.productionBatchesService.getProductionBatch(user, storeId, batchId);
  }

  @Post()
  @Roles('OWNER', 'ADMIN', 'INVENTORY_MANAGER', 'PRODUCTION_MANAGER')
  createProductionBatch(
    @CurrentUser() user: AuthUser,
    @Param('storeId', new ParseUUIDPipe()) storeId: string,
    @Body() dto: CreateProductionBatchDto,
  ) {
    return this.productionBatchesService.createProductionBatch(user, storeId, dto);
  }

  @Patch(':batchId')
  @Roles('OWNER', 'ADMIN', 'INVENTORY_MANAGER', 'PRODUCTION_MANAGER')
  updateProductionBatch(
    @CurrentUser() user: AuthUser,
    @Param('storeId', new ParseUUIDPipe()) storeId: string,
    @Param('batchId', new ParseUUIDPipe()) batchId: string,
    @Body() dto: UpdateProductionBatchDto,
  ) {
    return this.productionBatchesService.updateProductionBatch(user, storeId, batchId, dto);
  }

  @Post(':batchId/start')
  @Roles('OWNER', 'ADMIN', 'INVENTORY_MANAGER', 'PRODUCTION_MANAGER')
  startProductionBatch(
    @CurrentUser() user: AuthUser,
    @Param('storeId', new ParseUUIDPipe()) storeId: string,
    @Param('batchId', new ParseUUIDPipe()) batchId: string,
  ) {
    return this.productionBatchesService.startProductionBatch(user, storeId, batchId);
  }

  @Post(':batchId/complete')
  @Roles('OWNER', 'ADMIN', 'INVENTORY_MANAGER', 'PRODUCTION_MANAGER')
  completeProductionBatch(
    @CurrentUser() user: AuthUser,
    @Param('storeId', new ParseUUIDPipe()) storeId: string,
    @Param('batchId', new ParseUUIDPipe()) batchId: string,
    @Body() dto: CompleteProductionBatchDto,
  ) {
    return this.productionBatchesService.completeProductionBatch(user, storeId, batchId, dto);
  }

  @Post(':batchId/cancel')
  @Roles('OWNER', 'ADMIN', 'INVENTORY_MANAGER', 'PRODUCTION_MANAGER')
  cancelProductionBatch(
    @CurrentUser() user: AuthUser,
    @Param('storeId', new ParseUUIDPipe()) storeId: string,
    @Param('batchId', new ParseUUIDPipe()) batchId: string,
  ) {
    return this.productionBatchesService.cancelProductionBatch(user, storeId, batchId);
  }

  @Post(':batchId/correct')
  @Roles('OWNER', 'ADMIN', 'INVENTORY_MANAGER', 'PRODUCTION_MANAGER')
  correctProductionBatch(
    @CurrentUser() user: AuthUser,
    @Param('storeId', new ParseUUIDPipe()) storeId: string,
    @Param('batchId', new ParseUUIDPipe()) batchId: string,
    @Body() dto: CorrectProductionBatchDto,
  ) {
    return this.productionBatchesService.correctProductionBatch(user, storeId, batchId, dto);
  }

  @Post(':batchId/correct-variance-reason')
  @Roles('OWNER', 'ADMIN', 'INVENTORY_MANAGER', 'PRODUCTION_MANAGER')
  correctProductionVarianceReason(
    @CurrentUser() user: AuthUser,
    @Param('storeId', new ParseUUIDPipe()) storeId: string,
    @Param('batchId', new ParseUUIDPipe()) batchId: string,
    @Body() dto: CorrectProductionVarianceReasonDto,
  ) {
    return this.productionBatchesService.correctProductionVarianceReason(
      user,
      storeId,
      batchId,
      dto,
    );
  }
}
