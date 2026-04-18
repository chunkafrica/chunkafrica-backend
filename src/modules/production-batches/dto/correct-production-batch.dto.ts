import { Type } from 'class-transformer';
import {
  IsDate,
  IsNumber,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';

export class CorrectProductionBatchDto {
  @Type(() => Date)
  @IsDate()
  correctedAt!: Date;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @IsPositive()
  correctedActualOutputQuantity!: number;

  @IsString()
  @MaxLength(120)
  reason!: string;

  @IsString()
  @MaxLength(1000)
  note!: string;
}
