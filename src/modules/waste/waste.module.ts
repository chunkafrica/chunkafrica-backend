import { Module } from '@nestjs/common';
import { WasteCategoriesController } from './waste-categories.controller';
import { WasteLogsController } from './waste-logs.controller';
import { WasteService } from './waste.service';

@Module({
  controllers: [WasteCategoriesController, WasteLogsController],
  providers: [WasteService],
})
export class WasteModule {}