import { IsString, IsNotEmpty, IsOptional, IsInt, IsBoolean, IsNumber  } from 'class-validator';
import { Type } from 'class-transformer';
import { PartialType } from '@nestjs/mapped-types';

export class CreateModuleDto {
  @IsString()
  @IsNotEmpty()
  code!: string;         // เช่น "MOD_HR", "MOD_INVENTORY"

  @IsString()
  @IsNotEmpty()
  name!: string;         // เช่น "Human Resources"

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;   // สำหรับจัดลำดับการแสดงผล

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  // ✅ เพิ่มฟิลด์ price เพื่ออนุญาตให้หน้าบ้านส่งราคาเข้ามาบันทึกได้โดยไม่ติด Error 400
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  price?: number;
}

export class UpdateModuleDto extends PartialType(CreateModuleDto) {}