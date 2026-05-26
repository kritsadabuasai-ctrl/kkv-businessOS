import { IsString, IsOptional, IsInt, IsEmail, IsBoolean } from 'class-validator';

export class CreateMemberDto {
  @IsInt()
  @IsOptional() 
  companyId?: number; 

  @IsInt()
  @IsOptional()
  shopId?: number;

  @IsString()
  @IsOptional()
  memberCode?: string;

  @IsString()
  @IsOptional()
  runningCodeType?: string;

  @IsString()
  @IsOptional()
  firstName?: string;

  @IsString()
  @IsOptional()
  lastName?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  lineUserId?: string;

  @IsString()
  @IsOptional()
  idCardNumber?: string;

  @IsString()
  @IsOptional()
  thaiId?: string;

  @IsString()
  @IsOptional()
  lineName?: string;

  @IsString()
  @IsOptional()
  linePicture?: string; // 🟢 ลิงก์ CDN นอกของ LINE คงไว้เป็น String ตามเดิม

  // 🚩 [แก้ไข] เปลี่ยนจาก profileImageUrl เดิม มาใช้ profileMediaId ของระบบ DMS
  @IsInt()
  @IsOptional()
  profileMediaId?: number;

  @IsBoolean()
  @IsOptional()
  isMarketingConsent?: boolean;
}