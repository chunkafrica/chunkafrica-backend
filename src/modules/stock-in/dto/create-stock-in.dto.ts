import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDate,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class CreateStockInItemDto {
  @IsUUID()
  inventoryItemId!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  quantity!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  unitCost!: number;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  expiryDate?: Date;
}

export class CreateStockInDto {
  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @Type(() => Date)
  @IsDate()
  receivedAt!: Date;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  externalReference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => CreateStockInItemDto)
  items!: CreateStockInItemDto[];
}