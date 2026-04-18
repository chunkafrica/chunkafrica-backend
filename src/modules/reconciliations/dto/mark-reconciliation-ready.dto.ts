import { IsOptional, IsString, MaxLength } from 'class-validator';

export class MarkReconciliationReadyDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
