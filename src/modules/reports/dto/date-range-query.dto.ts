import { Type } from 'class-transformer';
import { IsDate, IsOptional } from 'class-validator';

export class DateRangeQueryDto {
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  from?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  to?: Date;
}