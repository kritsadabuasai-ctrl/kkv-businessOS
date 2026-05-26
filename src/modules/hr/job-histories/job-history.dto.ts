import { IsInt, IsOptional, IsString, IsDateString, IsEnum } from 'class-validator';

export class CreateJobHistoryDto {
  @IsInt()
  employeeId!: number;

  @IsOptional()
  @IsInt()
  departmentId?: number;

  @IsOptional()
  @IsInt()
  positionId?: number;

  @IsOptional()
  @IsString()
  action?: string; // 🆕 ฟิลด์ใหม่ที่เพิ่งเพิ่ม (เช่น 'HIRE', 'TRANSFER', 'PROMOTE')

  // 🌟 เพิ่ม managerId เข้าไป
  @IsOptional()
  @IsInt()
  managerId?: number;

  @IsDateString()
  startDate!: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  remarks?: string;
}

export class UpdateJobHistoryDto {
  @IsOptional()
  @IsInt()
  departmentId?: number;

  @IsOptional()
  @IsInt()
  positionId?: number;

  @IsOptional()
  @IsString()
  action?: string; // 🆕 ฟิลด์ใหม่ที่เพิ่งเพิ่ม

  // 🌟 เพิ่ม managerId เข้าไปใน Update ด้วย
  @IsOptional()
  @IsInt()
  managerId?: number;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  remarks?: string;
}

export class AssignManagerDto {
  @IsInt()
  employeeId!: number;

  @IsInt()
  targetDepartmentId!: number;

  @IsString()
  @IsEnum(['ASSIGN_MANAGER', 'TRANSFER_AND_MANAGE'])
  actionType!: 'ASSIGN_MANAGER' | 'TRANSFER_AND_MANAGE';

  @IsDateString()
  effectiveDate!: string;

  @IsOptional()
  @IsString()
  remarks?: string;

  @IsOptional()
  @IsString()
  @IsEnum(['MANAGER', 'DEPUTY'])
  roleType?: 'MANAGER' | 'DEPUTY' = 'MANAGER';
}