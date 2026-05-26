import { IsString, IsNotEmpty, IsOptional, IsNumber, IsBoolean, IsInt, Min } from 'class-validator';
import { PartialType } from '@nestjs/swagger'; // 👈 1. นำเข้า PartialType จาก Swagger

export class CreateAiModelConfigDto {
  @IsOptional()
  @IsInt()
  companyId?: number; // NULL = ราคากลาง KKV, NOT NULL = ราคาตัวแทน

  @IsString()
  @IsNotEmpty()
  provider!: string; // เช่น GOOGLE, OPENAI

  @IsString()
  @IsNotEmpty()
  modelCode!: string; // เช่น gemini-1.5-flash

  @IsString()
  @IsNotEmpty()
  modelName!: string; // ชื่อแสดงผล

  @IsNumber()
  @Min(0)
  @IsOptional()
  creditPer1kTokens?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  markupMultiplier?: number;

  @IsInt()
  @IsOptional()
  maxContextTokens?: number;

  @IsBoolean()
  @IsOptional()
  isVisionSupported?: boolean;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

// 👈 2. ใช้ PartialType เพื่อแปลงทุกฟิลด์ด้านบนให้เป็น Optional (อนุญาตให้ส่งไม่ครบได้ตอนแก้ไข)
export class UpdateAiModelConfigDto extends PartialType(CreateAiModelConfigDto) {}