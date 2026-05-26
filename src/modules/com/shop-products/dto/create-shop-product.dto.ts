import { IsInt, IsNotEmpty, IsOptional, IsNumber, IsBoolean, IsString } from 'class-validator';

export class CreateShopProductDto {
  @IsInt()
  @IsNotEmpty()
  shopId: number;

  @IsInt()
  @IsNotEmpty()
  productId: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean; // ขาย/ไม่ขาย ในร้านนี้

  @IsNumber()
  @IsOptional()
  priceOverride?: number; // ถ้าไม่ส่งมา = ใช้ราคา Master

  @IsString()
  @IsOptional()
  nameOverride?: string; // ถ้าอยากตั้งชื่อสินค้าใหม่เฉพาะร้านนี้

  @IsString()
  @IsOptional()
  featuredImageUrl?: string; // รูปปกเฉพาะร้านนี้
}