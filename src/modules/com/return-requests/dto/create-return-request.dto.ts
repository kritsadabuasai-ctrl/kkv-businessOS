import { IsNotEmpty, IsInt, IsString, IsArray, ValidateNested, IsOptional, IsEnum, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { RmaType } from '@prisma/client'; // ✅ Import Enum จาก Prisma โดยตรง

export class ReturnItemDto {
  @IsInt()
  @IsNotEmpty()
  orderItemId!: number; // คืนรายการไหนใน Order

  @IsInt()
  @Min(1)
  qty!: number; // จำนวนที่คืน

  @IsString()
  @IsOptional()
  condition?: string; // สภาพสินค้า (เช่น กล่องบุบ, เปิดแล้ว)

  @IsInt()
  @IsOptional()
  targetProductId?: number; // (กรณีเปลี่ยนของ) อยากได้สินค้าตัวไหนแทน
}

// 📄 [NEW] DTO สำหรับรับข้อมูลเอกสารแนบ (DMS)
export class ReturnDocumentDto {
  @IsInt()
  @IsNotEmpty()
  mediaId!: number; // ID จากตาราง SysMedia

  @IsString()
  @IsNotEmpty()
  docType!: string; // เช่น 'DAMAGE_EVIDENCE', 'REFUND_SLIP'
}

export class CreateReturnRequestDto {
  @IsInt()
  @IsNotEmpty()
  orderId!: number;

  @IsInt()
  @IsNotEmpty()
  shopId!: number; 

  @IsEnum(RmaType)
  @IsNotEmpty()
  type!: RmaType; // REFUND, EXCHANGE, REPAIR

  @IsString()
  @IsNotEmpty()
  reason!: string;

  @IsString()
  @IsOptional()
  description?: string; 

  // 📦 รายการสินค้าที่คืน
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReturnItemDto)
  @IsNotEmpty()
  items!: ReturnItemDto[];

  // 📂 [NEW] เอกสารหลักฐานประกอบการเคลม (รูปภาพของพัง, สลิป ฯลฯ)
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReturnDocumentDto)
  documents?: ReturnDocumentDto[];
}