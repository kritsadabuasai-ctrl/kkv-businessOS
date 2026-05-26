import { IsString, IsNotEmpty, IsInt, IsEnum, IsBoolean, IsOptional, IsNumber, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { BreakType } from '@prisma/client';

// ==========================================
// 1. DTO หาง (Detail) - ช่วงเวลาพักย่อย
// ==========================================
export class HrTimeBreakDetailDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsOptional()
  startTime?: string;

  @IsString()
  @IsOptional()
  endTime?: string;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  triggerAfterHours?: number;

  @IsInt()
  @IsNotEmpty()
  @Type(() => Number)
  duration!: number;
}

// ==========================================
// 2. DTO หัว (Master) - ชุดเวลาพัก
// ==========================================
export class CreateHrTimeBreakGroupDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  // 🚩 Type ถูกย้ายมาคุมที่ Master
  @IsEnum(BreakType)
  @IsOptional()
  type?: BreakType = 'FIXED_TIME';

  @IsBoolean()
  @IsOptional()
  isActive?: boolean = true;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HrTimeBreakDetailDto)
  @IsOptional()
  details?: HrTimeBreakDetailDto[];
}

export class UpdateHrTimeBreakGroupDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsEnum(BreakType)
  @IsOptional()
  type?: BreakType;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HrTimeBreakDetailDto)
  @IsOptional()
  details?: HrTimeBreakDetailDto[];
}