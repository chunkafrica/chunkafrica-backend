import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { InventoryAdjustmentReasonCode } from '@prisma/client';

export class UpsertReconciliationItemDto {
  @IsUUID()
  inventoryItemId!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  actualQuantity!: number;

  @IsOptional()
  @IsEnum(InventoryAdjustmentReasonCode)
  reasonCode?: InventoryAdjustmentReasonCode;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class UpsertReconciliationItemsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => UpsertReconciliationItemDto)
  items!: UpsertReconciliationItemDto[];
}
