import { PartialType } from '@nestjs/mapped-types';
import { CreateProductionBatchDto } from './create-production-batch.dto';

export class UpdateProductionBatchDto extends PartialType(CreateProductionBatchDto) {}