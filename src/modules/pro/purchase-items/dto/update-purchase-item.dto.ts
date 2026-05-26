import { IsInt, IsNumber, IsOptional, Min, IsString } from 'class-validator';

export class UpdatePurchaseItemDto {
  @IsNumber()
  @IsOptional()
  @Min(0)
  unitCost?: number; // แก้ราคาทุน (เผื่อ Supplier ปรับราคา)

  @IsInt()
  @IsOptional()
  @Min(0)
  qty?: number; // แก้จำนวนสั่ง (เผื่อคีย์ผิด)
}

export class ReceivePurchaseItemDto {
  @IsInt()
  @Min(1)
  qtyReceived!: number; // จำนวนที่รับของรอบนี้ (เช่น สั่ง 10 รับ 5)
}