import { IsString, IsNotEmpty, IsOptional, IsInt, IsBoolean, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateTiktokShopDto {
  @IsString()
  @IsNotEmpty()
  sellerId!: string; // ID บัญชีผู้ขาย

  @IsString()
  @IsNotEmpty()
  shopId!: string; // ต้องตรงกับ @unique ใน schema

  @IsString()
  @IsNotEmpty()
  shopCipher!: string; // รหัสอ้างอิงของร้าน (สำคัญสำหรับ API v2)

  @IsOptional()
  @IsString()
  sellerName?: string;

  @IsOptional()
  @IsString()
  shopName?: string;

  @IsOptional()
  @IsString()
  region?: string; // เช่น TH, VN

  @IsString()
  @IsNotEmpty()
  accessToken!: string;

  @IsOptional()
  @IsString()
  refreshToken?: string;

  @IsOptional()
  @IsDateString()
  accessTokenExpiresAt?: string;

  @IsOptional()
  @IsDateString()
  refreshTokenExpiresAt?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  externalConnectionId?: number; // ไอดีจากการเชื่อมต่อ OAuth

  @IsOptional()
  @IsBoolean()
  isAiEnabled?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  aiBotId?: number;
}

import { PartialType } from '@nestjs/mapped-types';
export class UpdateTiktokShopDto extends PartialType(CreateTiktokShopDto) {}