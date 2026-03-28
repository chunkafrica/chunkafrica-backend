import { Type } from 'class-transformer';
import {
  IsDate,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateWasteLogDto {
  @IsUUID()
  inventoryItemId!: string;

  @IsUUID()
  wasteCategoryId!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @IsPositive()
  quantity!: number;

  @Type(() => Date)
  @IsDate()
  occurredAt!: Date;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  costAtLossSnapshot?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}