import { 
  IsString, 
  IsNotEmpty, 
  IsOptional, 
  IsInt, 
  IsBoolean, 
  IsNumber, 
  IsArray, 
  ValidateNested 
} from 'class-validator';
import { Type } from 'class-transformer';

// -------------------------------------------------------
// 🏦 DTO: ข้อมูลบัญชีธนาคาร
// -------------------------------------------------------
export class CreateBankDto {
  @IsString() @IsNotEmpty() bankCode!: string;
  @IsString() @IsNotEmpty() bankName!: string;
  @IsString() @IsNotEmpty() accountNo!: string;
  @IsString() @IsNotEmpty() accountName!: string;
  @IsOptional() @IsString() branch?: string;
  @IsOptional() @IsBoolean() isDefault?: boolean;
}

// -------------------------------------------------------
// 📄 DTO: ข้อมูลเอกสารร้านค้า (KYC, สมุดบัญชี, ทะเบียนพาณิชย์)
// -------------------------------------------------------
export class ShopDocumentDto {
  @IsInt()
  mediaId!: number; // 📁 ID จากตาราง SysMedia

  @IsOptional()
  @IsString()
  docType?: string; // เช่น 'DBD_CERTIFICATE', 'ID_CARD', 'BANK_BOOK'
}

// -------------------------------------------------------
// 🏪 DTO: ข้อมูลร้านค้าหลัก (Create)
// -------------------------------------------------------
export class CreateShopProfileDto {
  @IsString() @IsNotEmpty() shopCode!: string;
  @IsString() @IsNotEmpty() shopName!: string;
  @IsOptional() @IsBoolean() isMainShop?: boolean;
  @IsOptional() @IsBoolean() isActive?: boolean;

  // 🖼️ โลโก้ร้านค้า (ผูก SysMedia)
  @IsOptional() @IsInt() logoMediaId?: number;

  // 🎨 ธีมและการแสดงผล
  @IsOptional() @IsString() primaryColor?: string;
  @IsOptional() @IsString() secondaryColor?: string;
  @IsOptional() @IsString() headingFont?: string;
  @IsOptional() @IsString() bodyFont?: string;

  // 🌐 URLs
  @IsOptional() @IsString() webBaseUrl?: string;
  @IsOptional() @IsString() lineOaUrl?: string;

  // 📈 Tracking Pixels
  @IsOptional() @IsString() googleAnalyticsId?: string;
  @IsOptional() @IsString() facebookPixelId?: string;
  @IsOptional() @IsString() tiktokPixelId?: string;

  // 📍 ที่อยู่หน้าร้าน (Storefront Address)
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() subDistrict?: string;
  @IsOptional() @IsString() district?: string;
  @IsOptional() @IsString() province?: string;
  @IsOptional() @IsString() zipCode?: string;
  @IsOptional() @IsString() phone?: string;

  // 🗺️ พิกัด
  @IsOptional() @IsNumber() @Type(() => Number) latitude?: number;
  @IsOptional() @IsNumber() @Type(() => Number) longitude?: number;

  // 🌐 โดเมนเฉพาะสำหรับหน้าร้านค้าออนไลน์
  @IsOptional()
  @IsString()
  customDomain?: string;

  // 📦 ที่อยู่สำหรับการขนส่ง (Logistics Address)
  @IsOptional() @IsString() warehouseAddress?: string;
  @IsOptional() @IsString() pickupAddress?: string;
  @IsOptional() @IsString() returnAddress?: string;

  // ⚙️ การตั้งค่าระบบ
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsString() timezone?: string;
  @IsOptional() @IsNumber() @Type(() => Number) taxRate?: number;
  @IsOptional() @IsBoolean() isVatIncluded?: boolean;

  // 💳 บัญชีธนาคาร
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateBankDto)
  bankAccounts?: CreateBankDto[];

  // 📂 เอกสารยืนยันตัวตน/ร้านค้า
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ShopDocumentDto)
  documents?: ShopDocumentDto[];
}