import { IsString, IsNotEmpty, IsOptional, IsInt, IsObject } from 'class-validator';

export class CreateLogAuditDto {
  @IsInt()
  @IsOptional() // Service จะเป็นคนใส่ให้เองจาก User Context
  companyId?: number; 

  @IsString()
  @IsNotEmpty()
  action!: string; 

  @IsString()
  @IsNotEmpty()
  tableName!: string; 

  @IsString()
  @IsNotEmpty()
  recordId!: string; 

  @IsInt()
  @IsOptional()
  userId?: number; 

  @IsObject()
  @IsOptional()
  oldValues?: any; 

  @IsObject()
  @IsOptional()
  newValues?: any; 

  @IsString()
  @IsOptional()
  ipAddress?: string;

  @IsString()
  @IsOptional()
  userAgent?: string;
}