import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDate,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
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
}