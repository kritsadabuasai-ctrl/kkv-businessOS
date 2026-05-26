import { IsString, IsInt, IsOptional, IsArray, ValidateNested, Min } from 'class-validator';
import { Type } from 'class-transformer';

// 🆕 DTO สำหรับรับข้อมูลตำแหน่งที่ผูกกับแผนก (Headcount Matrix)
export class DepartmentPositionItemDto {
  @IsInt()
  positionId!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxHeadcount?: number; // จำนวนคนที่รับได้ (เว้นว่างได้ถ้าไม่จำกัด)
}

// 1. DTO สำหรับสร้างแผนก
export class CreateDepartmentDto {
  @IsInt()
  @IsOptional() // ✅ Controller จะเติมให้จาก Token
  companyId?: number;

  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  parentId?: number; // ใส่ ID ของแผนกแม่ (ถ้ามี)

  @IsOptional()
  @IsInt()
  sortOrder?: number; // ลำดับการแสดงผล

  // 🆕 รับ Array ของตำแหน่งที่ต้องการเพิ่มในแผนกนี้
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DepartmentPositionItemDto)
  positions?: DepartmentPositionItemDto[];
}

// 2. DTO สำหรับแก้ไข
export class UpdateDepartmentDto {
  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  parentId?: number;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  // 🆕 รับ Array ของตำแหน่งเพื่ออัปเดต (ส่งมาทับของเดิม)
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DepartmentPositionItemDto)
  positions?: DepartmentPositionItemDto[];
}

// 3. DTO สำหรับการ Update Tree (หลังจากลากวาง)
export class DepartmentTreeUpdateItemDto {
  @IsInt()
  id!: number;

  @IsOptional()
  @IsInt()
  parentId?: number;

  @IsInt()
  sortOrder!: number;
}

export class UpdateDepartmentTreeDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DepartmentTreeUpdateItemDto)
  treeUpdates!: DepartmentTreeUpdateItemDto[];
}