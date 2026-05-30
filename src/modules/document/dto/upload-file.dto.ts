import { IsInt, IsNotEmpty, IsOptional, IsString, IsNumber,IsBoolean, IsArray, ValidateNested,IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

// คลาสลูกสำหรับ Metadata
class FileMetadataDto {
  @IsString()
  @IsNotEmpty()
  key!: string;

  @IsString()
  @IsNotEmpty()
  value!: string;
}

export class UploadFileDto {
  @IsOptional()
  @IsInt()
  companyId?: number;

  @IsOptional()
  @IsInt()
  uploadedById?: number; 

  @IsOptional()
  @IsInt()
  folderId?: number;

  @IsString()
  @IsNotEmpty()
  fileName!: string;

  @IsString()
  @IsNotEmpty()
  fileExtension!: string;

  @IsNumber()
  @IsNotEmpty()
  fileSize!: number;

  @IsString()
  @IsNotEmpty()
  url!: string; 

  // 🌟 [เพิ่มใหม่] สำหรับบันทึกใน Version 1
  @IsOptional()
  @IsString()
  changeLog?: string;

  // 🌟 [เพิ่มใหม่] รับรหัสประเภทเอกสารจากหน้าบ้าน นำไปใช้หา Code Running
  @IsOptional()
  @IsString()
  docCode?: string;

  // 🌟 [เพิ่มใหม่] สำหรับบันทึกข้อมูล Metadata ตอนเริ่มต้น
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FileMetadataDto)
  metadata?: FileMetadataDto[];

  @IsOptional()
  @IsDateString()
  autoDeleteAt?: string; // รับค่าเป็น ISO Date String เช่น "2026-12-31"

  @IsOptional()
  @IsString()
  documentNo?: string;

  @IsOptional()
  @IsString()
  filePassword?: string;

  // 💧 [Future] เปิด/ปิดลายน้ำสำหรับไฟล์นี้
  @IsOptional()
  @IsBoolean()
  isWatermarkEnabled?: boolean;

  // 🚨 [Future] ตรวจสอบว่าเป็นข้อมูลอ่อนไหว (Sensitive Data) หรือไม่
  @IsOptional()
  @IsBoolean()
  isSensitiveData?: boolean;

  // 🚨 [Future] คะแนนความเสี่ยง/ความลับของข้อมูล (0-100)
  @IsOptional()
  @IsNumber()
  sensitivityScore?: number;
}