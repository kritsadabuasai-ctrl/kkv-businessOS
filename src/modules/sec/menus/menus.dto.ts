import { IsString, IsOptional, IsInt, IsBoolean } from 'class-validator';

export class CreateMenuDto {
  @IsString()
  name!: string; // ชื่อเมนู

  @IsOptional()
  @IsString()
  path?: string; // URL path

  @IsOptional()
  @IsString()
  icon?: string; // ชื่อ Icon (เช่น 'user', 'settings')

  @IsOptional()
  @IsInt()
  parentId?: number; // เมนูแม่ (ถ้ามี)

  @IsOptional()
  @IsInt()
  moduleId?: number; // ✅ เพิ่ม: สังกัด Module ไหน (ถ้า Null = เมนูพื้นฐาน)

  @IsOptional()
  @IsInt()
  sortOrder?: number; // ลำดับการแสดงผล

  @IsOptional()
  @IsBoolean()
  isVisible?: boolean; // ซ่อน/แสดง

  // 🌟 เพิ่มฟิลด์ isSystem
  @IsOptional()
  @IsBoolean()
  isSystem?: boolean; // ระบุว่าเป็นเมนูหลักของระบบหรือไม่ (ห้ามลบ)
}

export class UpdateMenuDto extends CreateMenuDto {}