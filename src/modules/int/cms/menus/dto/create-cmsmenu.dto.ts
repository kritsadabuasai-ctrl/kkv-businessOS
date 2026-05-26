import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsInt } from 'class-validator';

export class CreateMenuDto {
  @IsString()
  @IsNotEmpty()
  label!: string;

  @IsString()
  @IsNotEmpty()
  url!: string;

  @IsBoolean()
  @IsOptional()
  isExternal?: boolean;

  @IsInt()
  @IsOptional()
  sortOrder?: number;

  @IsInt()
  @IsOptional()
  parentId?: number; // ถ้าเป็น null คือเมนูหลัก, ถ้ามีเลขคือเมนูย่อย

  // 🌟 ส่วนที่เพิ่มมาใหม่เพื่อรองรับ Mega Menu
  @IsString()
  @IsOptional()
  description?: string; // คำอธิบายย่อยใต้ชื่อเมนู

  @IsString()
  @IsOptional()
  imageUrl?: string; // รูปภาพประกอบเมนู

  @IsBoolean()
  @IsOptional()
  isMegaMenu?: boolean; // สวิตช์บอกหน้าบ้านให้แสดงเป็น Mega Menu
}