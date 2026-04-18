import { IsIn, IsString, MaxLength } from 'class-validator';
import { CompleteProductionBatchDto } from './complete-production-batch.dto';

export class CorrectProductionVarianceReasonDto {
  @IsString()
  @IsIn(CompleteProductionBatchDto.varianceReasonCodes)
  nextVarianceReasonCode!: (typeof CompleteProductionBatchDto.varianceReasonCodes)[number];

  @IsString()
  @MaxLength(120)
  reason!: string;

  @IsString()
  @MaxLength(1000)
  note!: string;
}
