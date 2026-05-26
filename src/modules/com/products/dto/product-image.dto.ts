import { 
  IsString, 
  IsOptional, 
  IsNumber, 
  IsArray, 
  IsNotEmpty, 
  IsBoolean 
} from 'class-validator';

export class ProductImageDto {
  @IsOptional()
  @IsNumber()
  id?: number;

  @IsString()
  @IsNotEmpty()
  url!: string;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;

  @IsOptional()
  @IsString()
  fileName?: string;

  @IsOptional()
  @IsString()
  displayName?: string;

  @IsOptional()
  @IsArray()
  tags?: any[]; 

  // ==========================================
  // 🌟 ฟิลด์ที่เพิ่มเข้ามาเพื่อแก้ Error TS2339
  // ==========================================

  @IsOptional()
  @IsString()
  mediaType?: string;

  @IsOptional()
  @IsString()
  fileId?: string;

  @IsOptional()
  @IsString()
  colorCode?: string;

  @IsOptional()
  imageVector?: any; // ใช้ any เพราะอาจจะเป็น Array ของตัวเลขสำหรับ AI Vector

  @IsOptional()
  @IsNumber()
  fileSize?: number;

  @IsOptional()
  @IsBoolean()
  isMain?: boolean;
}