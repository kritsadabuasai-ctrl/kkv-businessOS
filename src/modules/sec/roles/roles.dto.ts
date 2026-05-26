import { IsString, IsOptional, IsInt, IsArray, IsBoolean } from 'class-validator';

export class CreateRoleDto {
  // ✅ เพิ่ม field นี้
  @IsOptional()
  @IsInt()
  companyId?: number;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  displayName?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isOrderNotified?: boolean;
  
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  permissionIds?: number[];

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  menuIds?: number[];
}

export class UpdateRoleDto extends CreateRoleDto {}