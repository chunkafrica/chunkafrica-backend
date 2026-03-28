import { PartialType } from '@nestjs/mapped-types';
import { CreateWasteCategoryDto } from './create-waste-category.dto';

export class UpdateWasteCategoryDto extends PartialType(CreateWasteCategoryDto) {}