import { IsString, IsNotEmpty, IsInt, IsBoolean, IsOptional, IsArray, ValidateNested, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

// ==========================================
// 1. DTO สำหรับหาง (Item รายวันในรอบ)
// ==========================================
export class HrWorkPatternItemDto {
  @IsInt()
  @Min(1)
  @Max(365)
  @Type(() => Number)
  dayIndex!: number; // ลำดับวันที่ในรอบ (เช่น 1-7)

  @IsInt()
  @IsOptional()
  @Type(() => Number)
  shiftId?: number | null; // ถ้าเป็น null คือ "วันหยุด"
}

// ==========================================
// 2. DTO สำหรับหัว (Master Pattern)
// ==========================================
export class CreateHrWorkPatternDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsInt()
  @Min(1)
  @Type(() => Number)
  cycleDays!: number; // จำนวนวันใน 1 รอบ เช่น 7 หรือ 14

  @IsBoolean()
  @IsOptional()
  isActive?: boolean = true;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HrWorkPatternItemDto)
  @IsOptional()
  items?: HrWorkPatternItemDto[];
}

export class UpdateHrWorkPatternDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsInt()
  @IsOptional()
  @Type(() => Number)
  cycleDays?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HrWorkPatternItemDto)
  @IsOptional()
  items?: HrWorkPatternItemDto[];
}