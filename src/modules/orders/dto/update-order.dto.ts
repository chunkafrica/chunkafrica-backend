import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDate,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SalesChannel, SalesOrderReasonCode } from '@prisma/client';
import { CreateOrderItemDto } from './create-order.dto';

export class UpdateOrderDto {
  @IsEnum(SalesOrderReasonCode)
  reasonCode!: SalesOrderReasonCode;

  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  note!: string;

  @IsOptional()
  @IsUUID()
  customerId?: string;

  @IsOptional()
  @IsEnum(SalesChannel)
  channel?: SalesChannel;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  orderedAt?: Date;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items?: CreateOrderItemDto[];
}
