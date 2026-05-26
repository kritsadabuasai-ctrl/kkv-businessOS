import { 
  IsString, 
  IsNotEmpty, 
  IsOptional, 
  IsInt, 
  IsBoolean, 
  IsNumber, 
  IsArray, 
  IsDateString,
  ValidateNested
} from 'class-validator';
import { Type } from 'class-transformer';

// 📄 DTO ย่อยสำหรับรับข้อมูลรูปภาพ/ไฟล์แนบโปรโมชั่น (DMS)
export class PromotionDocumentDto {
  @IsInt()
  @IsNotEmpty()
  mediaId!: number; // 📁 ID จากตาราง SysMedia
}

export class CreateDiscountDto {
  @IsInt()
  @IsOptional()
  companyId?: number; 

  @IsInt()
  @IsOptional()
  @Type(() => Number)
  shopId?: number; // รองรับผูกคูปองรายร้าน (ถ้า null = ใช้ได้ทุกร้านในเครือ)

  @IsString()
  @IsNotEmpty({ message: 'กรุณาระบุรหัสคูปอง/โปรโมชั่น' })
  code!: string; 

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  discountType?: string; // FIXED (ลดจำนวนเงิน) หรือ PERCENTAGE (ลดเป็น %)

  @IsNumber()
  @IsOptional()
  discountValue?: number; 

  @IsNumber()
  @IsOptional()
  minPurchaseAmount?: number; 

  @IsNumber()
  @IsOptional()
  maxDiscountAmount?: number; 

  @IsBoolean()
  @IsOptional()
  isFreeShipping?: boolean; 

  @IsString()
  @IsOptional()
  appliesTo?: string; // ALL (ทั้งร้าน), CATEGORY (หมวดหมู่), PRODUCT (เฉพาะสินค้า)

  @IsOptional()
  targetIds?: any; // ข้อมูล JSON ลิสต์ ID สินค้าหรือหมวดหมู่ที่ร่วมรายการ

  @IsInt()
  @IsOptional()
  maxUsageTotal?: number;

  @IsInt()
  @IsOptional()
  maxUsagePerUser?: number;

  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  // 📂 [NEW] รองรับการแนบสื่อ/รูปภาพโปรโมชั่นจาก DMS เป็นแบบ Array
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PromotionDocumentDto)
  documents?: PromotionDocumentDto[];
}