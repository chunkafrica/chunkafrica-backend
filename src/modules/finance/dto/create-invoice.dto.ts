import { Type } from 'class-transformer';
import {
  IsDate,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateInvoiceDto {
  @IsUUID()
  salesOrderId!: string;

  @Type(() => Date)
  @IsDate()
  issueDate!: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  dueDate?: Date;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
