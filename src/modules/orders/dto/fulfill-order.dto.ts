import { Type } from 'class-transformer';
import { IsDate, IsOptional, IsString, MaxLength } from 'class-validator';

export class FulfillOrderDto {
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  fulfilledAt?: Date;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
