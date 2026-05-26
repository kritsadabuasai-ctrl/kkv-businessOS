import { IsString, IsInt, IsOptional, Min } from 'class-validator';

// 1. DTO สำหรับสร้างตำแหน่งใหม่
export class CreatePositionDto {
  @IsInt()
  @IsOptional() // ✅ Controller จะเติมให้
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
  @Min(1)
  level?: number; 
}

// 2. DTO สำหรับแก้ไข (Update)
export class UpdatePositionDto {
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
  @Min(1)
  level?: number;
}