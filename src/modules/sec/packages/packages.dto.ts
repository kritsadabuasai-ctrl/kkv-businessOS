import { IsString, IsOptional, IsBoolean, IsInt, IsNumber, Min, IsArray , IsNotEmpty } from 'class-validator';

export class CreatePackageDto {
  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @IsNumber() 
  @IsOptional() 
  aiTokenLimit?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  maxCompanies?: number;

  // 🌟 เพิ่มตรงนี้ครับ เพื่อให้ตอน "สร้าง" รับค่าราคาส่งได้ด้วย
  @IsNumber()
  @IsOptional()
  @Min(0)
  resellerPrice?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  maxUsers?: number;

  // 🌟 1. เพิ่มฟิลด์ maxShops ตรงนี้ครับ
  @IsOptional()
  @IsInt()
  @Min(0)
  maxShops?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  maxStorageMB?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  moduleIds?: number[];
}

export class UpdatePackageDto {
  // ✅ เพิ่ม code เพื่อให้ตรงกับที่ Frontend ส่งมา (แม้จะไม่แก้ไขก็ตาม)
  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  resellerPrice?: number; // 🌟 เพิ่มตรงนี้

  @IsNumber() 
  @IsOptional() 
  aiTokenLimit?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  maxCompanies?: number;

  // 🌟 2. เพิ่มฟิลด์ maxShops ตรงนี้ครับ
  @IsOptional()
  @IsInt()
  @Min(0)
  maxShops?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  maxUsers?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  maxStorageMB?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  moduleIds?: number[];
}

export class SetCustomPriceDto {
  @IsNotEmpty()
  @IsInt()
  packageId!: number;

  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  customPrice!: number; // ราคาขายปลีกที่ตัวแทนต้องการ

  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  customResellerPrice!: number; // ราคาส่งให้ลูกทีม (ถ้ามี)
}