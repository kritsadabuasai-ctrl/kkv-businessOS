import { 
  IsString, 
  IsNumber, 
  IsOptional, 
  IsArray, 
  IsEnum, 
  IsBoolean, 
  ValidateNested, 
  IsNotEmpty, 
  IsInt, 
  IsObject 
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ProductStatus, ProductType, ProductSalesType } from '@prisma/client';
import { ProductImageDto } from './product-image.dto';

export class CreateProductDto {
  // ==============================
  // ข้อมูลพื้นฐาน (Basic Info)
  // ==============================
  @IsOptional()
  @IsString() 
  @IsNotEmpty() 
  sku?: string;

  @IsOptional()
  @IsString() 
  @IsNotEmpty() 
  name?: string;

  @IsOptional() 
  @IsString() 
  description?: string;

  @IsOptional() 
  @IsEnum(ProductStatus) 
  status?: ProductStatus;

  @IsOptional() 
  @IsEnum(ProductType) 
  productType?: ProductType;

  @IsOptional() 
  @IsEnum(ProductSalesType) 
  salesType?: ProductSalesType;

 // ==============================
  // ข้อมูลราคา (Pricing)
  // ==============================
  @IsOptional() // 🌟 เพิ่มบรรทัดนี้: เพื่อให้สินค้าลูกไม่ต้องส่งราคามาก็ได้
  @IsNumber() 
  @Transform(({ value }) => {
    // ถ้าไม่มีค่าส่งมา ให้คืนค่า undefined เพื่อให้ @IsOptional ผ่าน
    if (value === '' || value === null || value === undefined || isNaN(Number(value))) {
      return undefined; 
    }
    if (typeof value === 'string') {
      return Number(value.replace(/,/g, ''));
    }
    return Number(value);
  })
  price?: number; // 🌟 เปลี่ยนจาก ! เป็น ?

  @IsOptional() 
  @IsNumber() 
  @Transform(({ value }) => {
    if (value === '' || value === null || value === undefined) return undefined;
    if (typeof value === 'string') return Number(value.replace(/,/g, ''));
    return Number(value);
  })
  costPrice?: number;

  @IsOptional() 
  @IsNumber() 
  @Transform(({ value }) => {
    if (value === '' || value === null || value === undefined) return undefined;
    if (typeof value === 'string') return Number(value.replace(/,/g, ''));
    return Number(value);
  })
  minTierPrice?: number;

  // ==============================
  // ความสัมพันธ์ (Relations / Master Data) - 🌟 เป็น ID ต้องแปลงเป็น Number
  // ==============================
  @IsOptional() 
  @IsInt() 
  @Type(() => Number) 
  categoryId?: number;

  @IsOptional() 
  @IsInt() 
  @Type(() => Number) 
  unitId?: number;

  @IsOptional() 
  @IsInt() 
  @Type(() => Number) 
  defaultSupplierId?: number;

  @IsOptional() 
  @IsInt() 
  @Type(() => Number) 
  boxSizeId?: number;

  // ==============================
  // ข้อมูลเพิ่มเติม & SEO
  // ==============================
  @IsOptional() @IsString() brand?: string;
  @IsOptional() @IsString() slug?: string;
  @IsOptional() @IsString() visibilityCode?: string;
  
  // แปลงค่า Boolean เผื่อหน้าบ้านส่งมาเป็น string "true"/"false"
  @IsOptional() 
  @IsBoolean() 
  @Transform(({ value }) => value === 'true' || value === true)
  isActive?: boolean;

  @IsOptional() 
  @IsBoolean() 
  @Transform(({ value }) => value === 'true' || value === true)
  isCancellable?: boolean;

  @IsOptional() 
  @IsBoolean() 
  @Transform(({ value }) => value === 'true' || value === true)
  isPreOrder?: boolean;

  // ==============================
  // ข้อมูลการจัดส่งและสต็อก - 🌟 ต้องแปลงเป็น Number
  // ==============================
  @IsOptional() 
  @IsNumber() 
  @Type(() => Number) 
  stockQty?: number;

  @IsOptional() 
  @IsInt() 
  @Type(() => Number) 
  daysToShip?: number;

  @IsOptional() 
  @IsNumber() 
  @Type(() => Number) 
  weight?: number;

  @IsOptional() 
  @IsNumber() 
  @Type(() => Number) 
  width?: number;

  @IsOptional() 
  @IsNumber() 
  @Type(() => Number) 
  length?: number;

  @IsOptional() 
  @IsNumber() 
  @Type(() => Number) 
  height?: number;

  @IsOptional() 
  @IsString() 
  featuredImageUrl?: string;

  // ==============================
  // กลุ่ม Tags (Array of Strings)
  // ==============================
  @IsOptional() 
  @IsArray() 
  @IsString({ each: true }) 
  tags?: string[];

  @IsOptional() 
  @IsArray() 
  @IsString({ each: true }) 
  usageTags?: string[];

  @IsOptional() 
  @IsArray() 
  @IsString({ each: true }) 
  materialTags?: string[];

  // ==============================
  // สินค้าลูก (Variants) และรูปภาพ
  // ==============================
  @IsOptional() 
  @IsObject() 
  variantAttributes?: any;

  @IsOptional() 
  @IsArray() 
  @ValidateNested({ each: true }) 
  @Type(() => ProductImageDto)
  images?: ProductImageDto[];

  @IsOptional() 
  @IsArray() 
  @ValidateNested({ each: true }) 
  @Type(() => CreateProductDto)
  variants?: CreateProductDto[];
}