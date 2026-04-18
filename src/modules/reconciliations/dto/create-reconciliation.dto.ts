import { Type } from 'class-transformer';
import { IsDate, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateReconciliationDto {
  @Type(() => Date)
  @IsDate()
  startedAt!: Date;

  @IsOptional()
  @IsUUID()
  sourceStockInRecordId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  correctionIntent?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
