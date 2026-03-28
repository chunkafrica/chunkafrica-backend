import { Type } from 'class-transformer';
import { IsDate, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateReconciliationDto {
  @Type(() => Date)
  @IsDate()
  startedAt!: Date;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}