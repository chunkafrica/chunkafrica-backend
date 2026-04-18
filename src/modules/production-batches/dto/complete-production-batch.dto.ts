import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDate,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsIn,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class CompleteProductionBatchIngredientDto {
  @IsUUID()
  inventoryItemId!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @IsPositive()
  actualQuantity!: number;
}

export class CompleteProductionBatchDto {
  static readonly varianceReasonCodes = [
    'yield_loss',
    'input_overuse',
    'quality_reject',
    'overproduction',
    'process_error',
    'damaged_output',
  ] as const;

  @Type(() => Date)
  @IsDate()
  completedAt!: Date;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @IsPositive()
  actualOutputQuantity!: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => CompleteProductionBatchIngredientDto)
  ingredients?: CompleteProductionBatchIngredientDto[];

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsOptional()
  @IsString()
  @IsIn(CompleteProductionBatchDto.varianceReasonCodes)
  varianceReasonCode?: (typeof CompleteProductionBatchDto.varianceReasonCodes)[number];
}
