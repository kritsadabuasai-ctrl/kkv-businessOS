import { IsString, IsNotEmpty, IsInt, IsEnum, IsDateString, IsBoolean, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { HolidayCategory, HolidayGroupStatus } from '@prisma/client';

// ==========================================
// 1. HOLIDAY GROUP DTO (MASTER)
// ==========================================
export class CreateHrHolidayGroupDto {
  @IsInt()
  @IsNotEmpty()
  @Type(() => Number)
  calendarId!: number;

  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsNotEmpty()
  nameTh!: string;

  @IsString()
  @IsOptional()
  nameEn?: string;

  @IsBoolean()
  @IsOptional()
  isCompensateWhenOffDay?: boolean = true;
}

export class UpdateHrHolidayGroupDto extends CreateHrHolidayGroupDto {
  @IsEnum(HolidayGroupStatus)
  @IsOptional()
  status?: HolidayGroupStatus;
}

// ==========================================
// 2. HOLIDAY DETAIL DTO (DETAIL)
// ==========================================
export class CreateHrHolidayDto {
  @IsInt()
  @IsNotEmpty()
  groupId!: number;

  @IsDateString()
  @IsNotEmpty()
  date!: string;

  @IsString()
  @IsNotEmpty()
  nameTh!: string;

  @IsString()
  @IsOptional()
  nameEn?: string;

  @IsEnum(HolidayCategory)
  @IsOptional()
  category?: HolidayCategory = 'PUBLIC';

  @IsBoolean()
  @IsOptional()
  isActive?: boolean = true;
}

export class UpdateHrHolidayDto {
  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsString()
  nameTh?: string;

  @IsOptional()
  @IsString()
  nameEn?: string;

  @IsOptional()
  @IsEnum(HolidayCategory)
  category?: HolidayCategory;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

// ==========================================
// 3. COPY/CLONE DTO
// ==========================================
export class CopyHrHolidayGroupDto {
  @IsInt()
  @IsNotEmpty()
  sourceGroupId!: number;

  @IsInt()
  @IsNotEmpty()
  targetCalendarId!: number;

  @IsString()
  @IsNotEmpty()
  newCode!: string;

  @IsString()
  @IsNotEmpty()
  newNameTh!: string;

  @IsString()
  @IsOptional()
  newNameEn?: string;
}