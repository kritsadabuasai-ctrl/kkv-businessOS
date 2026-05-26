import { IsString, IsInt, IsBoolean, IsOptional } from 'class-validator';

export class UpsertSmtpConfigDto {
  @IsOptional()
  @IsInt()
  shopId?: number; // ส่งมาเฉพาะถ้าเป็นการตั้งค่าระดับร้านค้า

  @IsString()
  senderName!: string;

  @IsString()
  senderEmail!: string;

  @IsString()
  host!: string;

  @IsInt()
  port!: number;

  @IsString()
  username!: string;

  @IsOptional()
  @IsString()
  password?: string; // ปล่อย Optional ไว้เผื่อกรณีอัปเดตข้อมูลแต่ไม่เปลี่ยนรหัสผ่าน

  @IsOptional()
  @IsBoolean()
  isSecure?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}