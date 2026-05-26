import { IsString, IsNotEmpty, IsOptional, IsInt, IsBoolean, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateFacebookPageDto {
  @IsString()
  @IsNotEmpty()
  pageName!: string;

  @IsString()
  @IsNotEmpty()
  pageId!: string; // ต้องตรงกับ @unique ใน schema

  @IsString()
  @IsNotEmpty()
  accessToken!: string;

  @IsOptional()
  @IsString()
  webhookUrl?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  externalConnectionId?: number; // ไอดีจากการเชื่อมต่อ OAuth (ตาราง IntExternalConnection)

  @IsOptional()
  @IsDateString()
  expiresAt?: string; // วันหมดอายุของ Token (รับเป็น ISO String)

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  aiBotId?: number;

  @IsOptional()
  @IsBoolean()
  isAiEnabled?: boolean;
}

// Update ใช้โครงสร้างเดียวกับ Create แต่อนุญาตให้ส่งมาแค่บางฟิลด์ได้ (Partial)
import { PartialType } from '@nestjs/mapped-types';
export class UpdateFacebookPageDto extends PartialType(CreateFacebookPageDto) {}