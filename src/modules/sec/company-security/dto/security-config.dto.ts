import { IsInt, IsBoolean, IsOptional, Min } from 'class-validator';

export class UpdateSecurityConfigDto {
  @IsInt()
  menuId!: number; // ID เมนูที่ต้องการตั้งค่า

  @IsBoolean()
  @IsOptional()
  requireReAuth?: boolean; // บังคับใส่รหัสซ้ำหรือไม่

  @IsBoolean()
  @IsOptional()
  requireMfa?: boolean; // บังคับใช้ MFA หรือไม่

  @IsInt()
  @IsOptional()
  @Min(0)
  gracePeriod?: number; // ระยะเวลาผ่อนผัน (นาที)
}