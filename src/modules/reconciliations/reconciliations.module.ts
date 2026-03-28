import { Module } from '@nestjs/common';
import { ReconciliationsController } from './reconciliations.controller';
import { ReconciliationsService } from './reconciliations.service';

@Module({
  controllers: [ReconciliationsController],
  providers: [ReconciliationsService],
})
export class ReconciliationsModule {}