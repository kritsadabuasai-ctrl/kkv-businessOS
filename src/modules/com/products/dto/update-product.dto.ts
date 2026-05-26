import { PartialType } from '@nestjs/mapped-types';
import { CreateProductDto } from './create-product.dto';
import { IsOptional, IsNumber } from 'class-validator';

export class UpdateProductDto extends PartialType(CreateProductDto) {
  @IsOptional()
  @IsNumber()
  id?: number; // สำหรับระบุ ID ของสินค้าตัวแม่หรือตัวลูกตอน Update
}