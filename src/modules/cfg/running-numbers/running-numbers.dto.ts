import { IsString, IsNotEmpty, IsOptional, IsInt, IsBoolean, IsEnum } from 'class-validator';

export enum ResetCriteria {
  DAILY = 'DAILY',
  MONTHLY = 'MONTHLY',
  YEARLY = 'YEARLY',
  NEVER = 'NEVER',
}

export class CreateRunningFormatDto {
  @IsString()
  @IsNotEmpty()
  docCode: string; // เช่น 'PO', 'INV'

  @IsString()
  @IsOptional()
  docName?: string;

  @IsString()
  @IsNotEmpty()
  formatPattern: string; // เช่น 'INV-{yyyy}{mm}-' 

  @IsInt()
  @IsNotEmpty()
  digitLength: number; // เช่น 5 (เพื่อรัน 00001) 

  @IsEnum(ResetCriteria)
  @IsOptional()
  resetCriteria?: ResetCriteria;
}

export class UpdateRunningFormatDto extends CreateRunningFormatDto {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}