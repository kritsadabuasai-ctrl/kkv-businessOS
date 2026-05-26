import { IsString, IsOptional, IsInt, IsEnum, IsDecimal, IsDateString, IsBoolean, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { AssetStatus, AcquisitionMethod, AssetRequestType, AssetRequestStatus } from '@prisma/client';

// --- Master: หมวดหมู่ครุภัณฑ์ ---
export class CreateAssetCategoryDto {
  @IsString() code!: string;
  @IsString() name!: string;
  @IsOptional() @IsString() prefixNumber?: string;
  @IsOptional() @IsInt() depreciationYears?: number;
}

// --- Core: ทะเบียนครุภัณฑ์ (รายตัว) ---
export class CreateAssetDto {
  @IsInt() categoryId!: number;
  @IsString() assetNumber!: string; // เลขครุภัณฑ์ (เช่น 7110-001/2569)
  @IsOptional() @IsString() serialNumber?: string;
  @IsString() name!: string;
  @IsOptional() @IsString() brandModel?: string;
  @IsInt() fiscalYear!: number;
  @IsDateString() acquisitionDate!: string;
  @IsEnum(AcquisitionMethod) acquisitionMethod!: AcquisitionMethod;
  @IsDecimal() purchasePrice!: number;
  @IsOptional() @IsString() vendorName?: string;
  @IsOptional() @IsEnum(AssetStatus) status?: AssetStatus;
  @IsOptional() @IsString() currentLocation?: string;
  @IsOptional() @IsInt() assignedToId?: number; // ผู้ครอบครอง
}

// --- Transaction Detail: รายการในใบคำร้อง ---
export class CreateAssetRequestItemDto {
  @IsOptional() @IsInt() assetId?: number; // มีค่าเมื่อเป็นการเบิก/ซ่อม/จำหน่าย
  @IsString() itemName!: string; // ชื่อพัสดุ (กรณีขอซื้อใหม่)
  @IsOptional() @IsDecimal() estimatedPrice?: number;
  @IsOptional() @IsInt() quantity?: number;
  @IsOptional() @IsString() remark?: string;
}

// --- Transaction: ใบคำร้อง (เบิก, ซ่อม, ซื้อ, จำหน่าย) ---
export class CreateAssetRequestDto {
  @IsEnum(AssetRequestType) requestType!: AssetRequestType;
  @IsInt() fiscalYear!: number;
  @IsInt() requesterId!: number;
  @IsString() subject!: string;
  @IsOptional() @IsString() reason?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateAssetRequestItemDto)
  items!: CreateAssetRequestItemDto[];
}