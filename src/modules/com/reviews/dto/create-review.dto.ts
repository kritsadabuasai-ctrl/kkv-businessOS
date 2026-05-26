import { IsInt, IsString, IsOptional, IsArray, Min, Max, IsNotEmpty } from 'class-validator';

export class CreateReviewDto {
  @IsInt()
  @IsNotEmpty()
  productId!: number;

  @IsInt()
  @IsOptional()
  orderId?: number; // สำหรับ Verified Buyer 

  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number; // 1-5 ดาว 

  @IsString()
  @IsOptional()
  comment?: string;

  // 🌟 [แก้ไขใหม่] เปลี่ยนจาก images: string[] เป็น mediaIds: number[]
  @IsArray()
  @IsOptional()
  mediaIds?: number[]; 
}