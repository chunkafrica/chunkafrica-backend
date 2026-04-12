import { Type } from 'class-transformer';
import { ProductionDefinitionType } from '@prisma/client';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class CreateRecipeItemDto {
  @IsUUID()
  inventoryItemId!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @IsPositive()
  quantityRequired!: number;
}

export class CreateRecipeDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsEnum(ProductionDefinitionType)
  definitionType!: ProductionDefinitionType;

  @IsOptional()
  @IsUUID()
  menuItemId?: string;

  @IsUUID()
  producedInventoryItemId!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @IsPositive()
  yieldQuantity!: number;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  instructions?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => CreateRecipeItemDto)
  items!: CreateRecipeItemDto[];
}
