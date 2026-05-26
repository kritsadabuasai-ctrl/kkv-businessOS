import { IsInt, IsOptional, IsString, IsBoolean, IsDateString } from 'class-validator';

// 1. DTO สำหรับเพิ่มประวัติการจ้างงาน
export class CreateEmploymentPeriodDto {
  @IsInt()
  employeeId: number;

  @IsDateString()
  startDate: string; // "2020-01-01"

  @IsOptional()
  @IsDateString()
  endDate?: string; 

  @IsOptional()
  @IsString()
  reason?: string; 

  @IsOptional()
  @IsBoolean()
  isDeductible?: boolean; 
}

// 2. DTO สำหรับแก้ไข
export class UpdateEmploymentPeriodDto {
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsBoolean()
  isDeductible?: boolean;
}