import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class UpdateReturnItemDto {
  @IsString()
  @IsOptional()
  condition?: string; // สภาพสินค้า (เช่น "กล่องบุบ", "อุปกรณ์ไม่ครบ")

  @IsInt()
  @Min(1)
  @IsOptional()
  qty?: number; // แก้ไขจำนวน (เผื่อลูกค้าส่งมาขาด/เกิน)

  @IsInt()
  @IsOptional()
  targetProductId?: number; // เปลี่ยนสินค้าที่จะเคลม (กรณี Exchange แล้วของเดิมหมด)
}