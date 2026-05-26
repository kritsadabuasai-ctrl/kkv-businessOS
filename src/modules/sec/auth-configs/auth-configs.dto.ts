import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

// สำหรับ Company Admin แก้ไขการตั้งค่าของตัวเอง
export class UpdateCompanyAuthConfigDto {
  @IsString()
  @IsNotEmpty()
  providerId!: string; // เช่น "LINE", "FACEBOOK"

  @IsBoolean()
  isEnabled!: boolean; // เปิด/ปิด การใช้งาน

  // Credentials (Optional: ถ้าไม่ใส่จะไปใช้ของ System Default)
  @IsOptional()
  @IsString()
  clientId?: string;

  @IsOptional()
  @IsString()
  clientSecret?: string;
}

// สำหรับ Super Admin แก้ไข System Global Config
export class UpdateSysAuthProviderDto {
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  isMaintenance?: boolean;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  iconUrl?: string;
}