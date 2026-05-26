import { IsArray, IsBoolean, IsInt, IsOptional, ValidateNested, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

class FileAccessRuleDto {
  // 🌟 ปรับให้ Optional เพราะอาจจะส่งมาแค่ userId ก็ได้
  @IsOptional()
  @IsInt()
  roleId?: number;

  // 🌟 [เพิ่มใหม่] รองรับการให้สิทธิ์รายบุคคล
  @IsOptional()
  @IsInt()
  userId?: number;

  @IsBoolean()
  canView!: boolean;

  @IsBoolean()
  canDownload!: boolean;

  // 🌟 [เพิ่มใหม่] รองรับวันหมดอายุของสิทธิ์
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

export class UpdateFileAccessDto {
  // 🌟 เปลี่ยนชื่อจาก FileAccessRoleDto เป็น FileAccessRuleDto ให้ดูครอบคลุมขึ้น
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FileAccessRuleDto)
  rules!: FileAccessRuleDto[]; // 🌟 หน้าบ้านต้องเปลี่ยนคีย์เวลาส่งจาก { "roles": [...] } เป็น { "rules": [...] }
}