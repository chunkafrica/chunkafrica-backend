import { SalesOrderReasonCode } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CancelOrderDto {
  @IsEnum(SalesOrderReasonCode)
  reasonCode!: SalesOrderReasonCode;

  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  note!: string;

  @IsOptional()
  @IsBoolean()
  settlementHandled?: boolean;
}
