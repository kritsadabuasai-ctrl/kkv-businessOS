import { IsString, IsNotEmpty, IsOptional, IsEmail, IsBoolean, IsArray, IsInt, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class UserRoleDto {
  @IsInt() @IsNotEmpty() companyId!: number;
  @IsInt() @IsNotEmpty() roleId!: number;
}

class EmployeeProfileDto {
  @IsString() @IsNotEmpty() employeeCode!: string;
  @IsString() @IsNotEmpty() joinDate!: string; 
  @IsInt() @IsNotEmpty() departmentId!: number;
  @IsInt() @IsNotEmpty() positionId!: number;
  @IsOptional() @IsString() status?: string;
}

export class CreateUserDto {
  @IsString() @IsNotEmpty() username!: string;
  // 🌟 ปรับเป็น 8 เพื่อให้ตรงตาม Policy ระบบ
  @IsString() @IsNotEmpty() @MinLength(8) password!: string; 
  @IsString() @IsNotEmpty() fullName!: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UserRoleDto)
  userRoles!: UserRoleDto[];

  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => EmployeeProfileDto)
  employee?: EmployeeProfileDto;

  @IsOptional() 
  @IsString() 
  phoneNumber?: string;
}

export class UpdateUserDto {
  @IsOptional() @IsString() fullName?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  // 🌟 เพิ่ม MinLength(8) เข้าไปที่นี่ด้วยครับ
  @IsOptional() @IsString() @MinLength(8) password?: string; 

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UserRoleDto)
  userRoles?: UserRoleDto[];

  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => EmployeeProfileDto)
  employee?: EmployeeProfileDto;

  @IsOptional() 
  @IsString() 
  phoneNumber?: string;
}

export class AdminResetPasswordDto {
  @IsNotEmpty({ message: 'กรุณาระบุรหัสผ่านใหม่' })
  @MinLength(8, { message: 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร' })
  newPassword!: string;
}