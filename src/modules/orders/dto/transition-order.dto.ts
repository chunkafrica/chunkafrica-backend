import { SalesOrderReasonCode, SalesOrderStatus } from '@prisma/client';
import {
  IsEnum,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class TransitionOrderDto {
  @IsEnum(SalesOrderStatus)
  nextStatus!: SalesOrderStatus;

  @IsEnum(SalesOrderReasonCode)
  reasonCode!: SalesOrderReasonCode;

  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  note!: string;
}
