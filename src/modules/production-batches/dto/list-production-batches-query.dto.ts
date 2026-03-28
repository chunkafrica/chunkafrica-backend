import { ProductionBatchStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsOptional } from 'class-validator';

export class ListProductionBatchesQueryDto {
  @IsOptional()
  @IsEnum(ProductionBatchStatus)
  status?: ProductionBatchStatus;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  from?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  to?: Date;
}