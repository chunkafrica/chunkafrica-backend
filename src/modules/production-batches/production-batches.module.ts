import { Module } from '@nestjs/common';
import { ProductionBatchesController } from './production-batches.controller';
import { ProductionBatchesService } from './production-batches.service';

@Module({
  controllers: [ProductionBatchesController],
  providers: [ProductionBatchesService],
})
export class ProductionBatchesModule {}