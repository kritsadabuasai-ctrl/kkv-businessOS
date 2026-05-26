import { IsString, IsEmail, IsNotEmpty, IsInt ,IsOptional, IsBoolean ,IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateTenantDto {
  // ข้อมูลบริษัท
  @IsString()
  companyName!: string; // เช่น "บริษัท โคตรเจ๋ง จำกัด"

  @IsString()
  companyCode!: string; // เช่น "KOOT-001" (ต้องไม่ซ้ำ)

  // 🌟 เพิ่มฟิลด์แพ็กเกจ
  @IsNotEmpty({ message: 'กรุณาระบุ Package ID' })
  @IsInt()
  packageId!: number;

  @IsOptional() @IsNumber() @Type(() => Number) paidAmount?: number;

  // 🌟 เพิ่มฟิลด์นี้เข้าไป เพื่อรับค่าตัวแทนจำหน่าย (ถ้ามี)
  @IsOptional()
  @IsInt()
  licenseHolderId?: number;

  // ข้อมูลผู้ดูแลระบบคนแรก (Super Admin ของบริษัทนี้)
  @IsString()
  adminUsername!: string;

  @IsEmail()
  adminEmail!: string;

  @IsString()
  adminFullName!: string;

  @IsOptional()
  @IsBoolean()
  isConfirmLink?: boolean; // 🌟 เพิ่มตัวนี้เข้ามา เพื่อรับสถานะการยืนยัน

  @IsOptional()
  @IsBoolean()
  isReseller?: boolean; // 🌟 เพิ่มตัวนี้เข้ามา เพื่อระบุว่าบริษัทนี้เป็นตัวแทนจำหน่ายหรือไม่
}