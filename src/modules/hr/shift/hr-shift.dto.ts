import { IsString, IsNotEmpty, IsInt, IsEnum, IsBoolean, IsOptional, ValidateNested, IsArray, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';
import { ShiftType, DayRelative } from '@prisma/client';

// ==========================================
// 1. SHIFT DETAIL DTO (หาง - ขอบเขตวันเท่านั้น)
// ==========================================
export class HrShiftDetailDto {
  @IsInt()
  @IsOptional()
  @Type(() => Number)
  previousShiftId?: number;

  @IsString()
  @IsNotEmpty()
  boundaryStartTime!: string;

  @IsEnum(DayRelative)
  @IsOptional()
  boundaryStartRel?: DayRelative = 'CURRENT';

  @IsString()
  @IsNotEmpty()
  boundaryEndTime!: string;

  @IsEnum(DayRelative)
  @IsOptional()
  boundaryEndRel?: DayRelative = 'NEXT';

  @IsInt()
  @IsOptional()
  priority?: number = 1;
}

// ==========================================
// 2. SHIFT CREATE DTO (สำหรับการสร้างใหม่)
// ==========================================
export class CreateHrShiftDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsOptional()
  color?: string;

  @IsEnum(ShiftType)
  @IsOptional()
  type?: ShiftType = 'WORK_DAY';


  @IsBoolean()
  @IsOptional()
  isOtBeforeShift?: boolean = false;

  @IsInt()
  @IsOptional()
  @Type(() => Number)
  minOtBeforeMinutes?: number = 0;

  @IsBoolean()
  @IsOptional()
  isOtAfterShift?: boolean = false;

  @IsInt()
  @IsOptional()
  @Type(() => Number)
  minOtAfterMinutes?: number = 0;

  @IsString()
  @IsNotEmpty()
  workStartTime!: string;

  @IsEnum(DayRelative)
  @IsOptional()
  workStartRel?: DayRelative = 'CURRENT';

  @IsString()
  @IsNotEmpty()
  workEndTime!: string;

  @IsEnum(DayRelative)
  @IsOptional()
  workEndRel?: DayRelative = 'CURRENT';

  @IsNumber()
  @IsNotEmpty()
  @Type(() => Number)
  totalDayHours!: number;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  firstHalfHours?: number = 4.0;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  secondHalfHours?: number = 4.0;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean = true;

  @IsArray()
  @IsInt({ each: true })
  @IsOptional()
  breakIds?: number[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HrShiftDetailDto)
  @IsOptional()
  details?: HrShiftDetailDto[];
}

// ==========================================
// 3. SHIFT UPDATE DTO (สำหรับการแก้ไข - ทุกอย่างเป็น Optional)
// ==========================================
export class UpdateHrShiftDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  color?: string;

  @IsEnum(ShiftType)
  @IsOptional()
  type?: ShiftType;

  @IsBoolean()
  @IsOptional()
  isOtBeforeShift?: boolean;

  @IsInt()
  @IsOptional()
  @Type(() => Number)
  minOtBeforeMinutes?: number;

  @IsBoolean()
  @IsOptional()
  isOtAfterShift?: boolean;

  @IsInt()
  @IsOptional()
  @Type(() => Number)
  minOtAfterMinutes?: number;

  @IsString()
  @IsOptional()
  workStartTime?: string;

  @IsEnum(DayRelative)
  @IsOptional()
  workStartRel?: DayRelative;

  @IsString()
  @IsOptional()
  workEndTime?: string;

  @IsEnum(DayRelative)
  @IsOptional()
  workEndRel?: DayRelative;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  totalDayHours?: number;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  firstHalfHours?: number;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  secondHalfHours?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsArray()
  @IsInt({ each: true })
  @IsOptional()
  breakIds?: number[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HrShiftDetailDto)
  @IsOptional()
  details?: HrShiftDetailDto[];
}