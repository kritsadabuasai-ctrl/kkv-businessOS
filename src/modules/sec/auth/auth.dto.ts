import { IsString, IsInt, MinLength, IsOptional, IsEmail, IsNotEmpty } from 'class-validator';

export class LoginDto {
  @IsString()
  @IsNotEmpty()
  username!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsInt()
  @IsOptional()
  companyId?: number; // ระบุบริษัทที่ต้องการเข้าใช้งาน
}

export class RegisterDto {
  @IsString()
  @IsNotEmpty()
  username!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  @IsNotEmpty()
  firstName!: string;
    
  @IsString()
  @IsNotEmpty()
  lastName!: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  // --- ข้อมูลบริษัท ---
  @IsString()
  @IsNotEmpty()
  companyName!: string; // ชื่อร้านค้า/บริษัท

  @IsString()
  @IsNotEmpty()
  companyCode!: string; // รหัสอ้างอิงบริษัท (เช่น KOOK-01)

  @IsString()
  @IsOptional()
  taxId?: string; // เลขผู้เสียภาษี (ถ้ามี)
}

// ✅ DTO ใหม่: สำหรับ Social Login & Digital ID
export class SocialLoginDto {
  @IsString()
  @IsNotEmpty()
  token!: string; // Access Token หรือ ID ที่ได้จาก Provider

  @IsInt()
  @IsOptional()
  companyId?: number; // กรณี User สังกัดหลายบริษัท
}

// =========================================================
// 📧 DTO สำหรับขอลืมรหัสผ่าน
// =========================================================
export class ForgotPasswordDto {
  @IsEmail({}, { message: 'รูปแบบอีเมลไม่ถูกต้อง' })
  @IsNotEmpty({ message: 'กรุณาระบุอีเมลที่ใช้ลงทะเบียน' })
  email!: string;
}

// =========================================================
// 🔑 DTO สำหรับตั้งรหัสผ่านใหม่
// =========================================================
export class ResetPasswordDto {
  @IsNotEmpty({ message: 'ไม่พบ Token สำหรับรีเซ็ตรหัสผ่าน' })
  @IsString()
  token!: string;

  @IsNotEmpty({ message: 'กรุณาระบุรหัสผ่านใหม่' })
  @MinLength(8, { message: 'รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร' })
  newPassword!: string;
}

export class RequestOtpDto {
  @IsEmail({}, { message: 'รูปแบบอีเมลไม่ถูกต้อง' })
  @IsNotEmpty({ message: 'กรุณาระบุอีเมล' })
  email!: string;

  @IsOptional()
  @IsInt()
  companyId?: number;

  @IsOptional()
  @IsInt()
  shopId?: number;

  // 🌟 ต้องเพิ่มบรรทัดนี้ครับ
  @IsOptional()
  @IsString()
  purpose?: string; 
}

export class VerifyOtpDto {
  @IsEmail({}, { message: 'รูปแบบอีเมลไม่ถูกต้อง' })
  @IsNotEmpty({ message: 'กรุณาระบุอีเมล' })
  email!: string;

  // 🌟 เปลี่ยนจาก otp!: string เป็น code!: string
  @IsString()
  @IsNotEmpty({ message: 'กรุณากรอกรหัส OTP' })
  code!: string; 

  @IsOptional()
  @IsInt()
  companyId?: number;

  @IsOptional()
  @IsInt()
  shopId?: number;

  @IsOptional()
  @IsString()
  purpose?: string; 
}