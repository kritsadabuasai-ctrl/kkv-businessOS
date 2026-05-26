import { IsNotEmpty, IsInt, IsOptional, IsDateString, IsString, IsArray, ValidateNested, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { PartialType } from '@nestjs/mapped-types';

export class PurchaseItemDto {
  @IsInt()
  @IsNotEmpty()
  productId!: number;

  @IsInt()
  @Min(1)
  qty!: number;

  @IsNumber()
  @Min(0)
  unitCost!: number; // ราคาทุน (Cost Price)

  // รายการนี้มัดรวมมาจาก Order ลูกค้าคนไหนบ้าง (ส่ง ID ของ ComOrderItem มา)
  @IsArray()
  @IsOptional()
  @IsInt({ each: true })
  comOrderItemIds?: number[]; 
}

// 📄 [NEW] DTO ย่อยสำหรับรับข้อมูลไฟล์เอกสารแนบจัดซื้อ (DMS)
export class PurchaseDocumentDto {
  @IsInt()
  @IsNotEmpty()
  mediaId!: number; // ID จากตาราง SysMedia

  @IsString()
  @IsNotEmpty()
  docType!: string; // 'PO', 'INVOICE', 'QUOTATION'
}

export class CreatePurchaseOrderDto {
  @IsInt()
  @IsNotEmpty()
  supplierId!: number;

  @IsDateString()
  @IsOptional()
  docDate?: string; // วันที่เอกสาร (Default = Now)

  @IsDateString()
  @IsOptional()
  dueDate?: string; // กำหนดส่งของ

  @IsString()
  @IsOptional()
  note?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PurchaseItemDto)
  items!: PurchaseItemDto[];

  // 📂 [NEW] รองรับการแนบไฟล์เอกสารหลายใบพร้อมกันเข้าระบบ DMS
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PurchaseDocumentDto)
  documents?: PurchaseDocumentDto[];
}

export class UpdatePurchaseOrderDto extends PartialType(CreatePurchaseOrderDto) {}