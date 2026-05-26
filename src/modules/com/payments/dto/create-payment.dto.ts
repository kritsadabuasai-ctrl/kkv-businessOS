import { IsNotEmpty, IsInt, IsNumber, IsString, IsOptional, IsDateString, IsArray } from 'class-validator';

export class CreatePaymentDto {
  @IsInt()
  @IsNotEmpty()
  orderId!: number;

  @IsInt()
  @IsNotEmpty()
  methodId!: number; // โอนเข้าบัญชีไหน (Bank Account ID / Payment Method ID)

  @IsNumber()
  @IsNotEmpty()
  amount!: number; // ยอดที่โอนจริง

  @IsDateString()
  @IsNotEmpty()
  transferredAt!: string; // วันเวลาที่โอน (ตามสลิป)

  @IsString()
  @IsOptional()
  slipUrl?: string; // พอร์ตแบบ String เดิม (คงไว้รองรับ Webhook ระบบภายนอก)

  @IsString()
  @IsOptional()
  refNo?: string; // เลขอ้างอิงท้ายสลิป (ถ้ามี)

  // 📁 [NEW] เชื่อมต่อระบบ DMS รองรับอัปโหลดสลิปผ่านคีย์ ID ของ SysMedia
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  mediaIds?: number[];
}