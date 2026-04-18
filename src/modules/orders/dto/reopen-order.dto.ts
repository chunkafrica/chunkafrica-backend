import { SalesOrderReasonCode } from '@prisma/client';
import { IsEnum, IsString, MaxLength, MinLength } from 'class-validator';

export class ReopenOrderDto {
  @IsEnum(SalesOrderReasonCode)
  reasonCode!: SalesOrderReasonCode;

  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  note!: string;
}
