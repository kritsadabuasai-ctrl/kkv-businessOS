import { IsString, IsNotEmpty, IsOptional, IsInt } from 'class-validator';

export class CreateMessageLogDto {
  // ✅ แก้เป็น IsOptional: หน้าบ้านไม่ต้องส่งมา เดี๋ยว Controller ใส่ให้จาก Token
  @IsInt()
  @IsOptional()
  companyId?: number; 

  @IsString()
  @IsNotEmpty()
  channel!: string; // เช่น EMAIL, LINE, SMS 

  @IsString()
  @IsNotEmpty()
  recipient!: string; // ผู้รับข้อความ 

  @IsString()
  @IsOptional()
  subject?: string; // หัวข้อ 

  @IsString()
  @IsOptional()
  content?: string; // เนื้อหา 

  @IsString()
  @IsNotEmpty()
  status!: string; // SUCCESS, FAILED

  @IsString()
  @IsOptional()
  errorMessage?: string; // ข้อความแสดงความผิดพลาด (ถ้ามี)

  @IsString()
  @IsOptional()
  refType?: string; // อ้างอิงประเภทระบบ เช่น ORDER, OTP

  @IsString()
  @IsOptional()
  refId?: string; // เลขที่เอกสารอ้างอิง
}