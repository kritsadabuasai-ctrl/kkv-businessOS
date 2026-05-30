import { IsInt, IsOptional, IsString, IsBoolean ,IsNumber ,IsNotEmpty } from 'class-validator';

export class CreateFileVersionDto {
  @IsInt()
  fileId!: number;

  @IsInt()
  companyId!: number;

  @IsString()
  url!: string;

  // 🌟 เปลี่ยนกลับมาเป็น fileSize ให้เหมือนเดิม
  @IsNumber()
  @IsNotEmpty()
  fileSize!: number;

  @IsOptional()
  @IsString()
  mimeType?: string;

  @IsOptional()
  @IsString()
  changeLog?: string;

  @IsOptional()
  @IsString()
  extractedText?: string;

  // 🌟 ฟิลด์ใหม่ที่เพิ่มเข้ามาตาม Schema ล่าสุด
  @IsOptional()
  @IsBoolean()
  isCurrent?: boolean;

  @IsOptional()
  @IsString()
  fileHash?: string;

  @IsOptional()
  @IsString()
  originalFileName?: string;

  @IsOptional()
  @IsBoolean()
  isAiSynced?: boolean;
}