import { IsString, IsNotEmpty, IsOptional, IsInt, IsBoolean, IsObject } from 'class-validator';

export class CreatePaymentMethodDto {
  @IsInt()
  @IsOptional()
  companyId?: number; // Controller ใส่ให้

  @IsString()
  @IsNotEmpty()
  code: string; // เช่น "KBANK", "SCB_QR", "STRIPE"

  @IsString()
  @IsNotEmpty()
  name: string; // ชื่อที่แสดงลูกค้า เช่น "โอนเงินกสิกรไทย"

  @IsString()
  @IsOptional()
  type?: string; // BANK_TRANSFER, QR_PAYMENT, CREDIT_CARD

  @IsObject()
  @IsOptional()
  config?: Record<string, any>; // ✅ เก็บ JSON ได้ (เช่น { accNo: "...", branch: "..." })

  @IsString()
  @IsOptional()
  instruction?: string; // คำแนะนำการโอน (HTML/Text)

  @IsString()
  @IsOptional()
  qrImage?: string; // URL รูป QR Code (ถ้ามี)

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}