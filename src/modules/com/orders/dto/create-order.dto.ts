import { IsNotEmpty, IsInt, IsArray, ValidateNested, IsString, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateOrderItemDto {
  @IsInt()
  @IsNotEmpty()
  productId!: number;

  @IsInt()
  @Min(1)
  quantity!: number;

  @IsString()
  @IsOptional()
  comment?: string;
}

// 📄 [NEW] DTO ย่อยสำหรับรับข้อมูลเอกสารการจัดส่งและภาษี (DMS)
export class ShippingDocumentDto {
  @IsInt()
  @IsNotEmpty()
  mediaId!: number; // 📁 ID จากตาราง SysMedia

  @IsString()
  @IsNotEmpty()
  docType!: string; // 'WAYBILL' (ใบปะหน้า), 'POD' (หลักฐานการส่ง), 'TAX_INVOICE'
}

export class CreateOrderDto {
  @IsInt()
  @IsNotEmpty()
  shopId!: number;

  @IsOptional()
  @IsInt()
  memberId?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items!: CreateOrderItemDto[];

  @IsInt()
  @IsOptional()
  shippingRuleId?: number;

  @IsString()
  @IsOptional()
  shippingAddress?: string;

  @IsOptional()
  @IsString()
  paymentType?: string; // FULL หรือ DEPOSIT

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  discountIds?: number[];

  // 📂 [NEW] รองรับการแนบเอกสารขนส่ง/ใบปะหน้า/ใบกำกับภาษี มาพร้อมตอนสร้างออเดอร์
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ShippingDocumentDto)
  shippingDocs?: ShippingDocumentDto[];
}