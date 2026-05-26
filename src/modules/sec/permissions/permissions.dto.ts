import { IsString, IsNotEmpty, IsOptional, IsInt } from 'class-validator';

export class CreatePermissionDto {
  @IsOptional()
  @IsInt()
  moduleId?: number;    // ✅ กลับมาใช้ moduleId (Integer) ตามเดิม

  @IsString()
  @IsNotEmpty()
  resource!: string;     // เช่น "user", "role"

  @IsString()
  @IsNotEmpty()
  action!: string;       // เช่น "view", "create", "update", "delete"

  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdatePermissionDto extends CreatePermissionDto {}