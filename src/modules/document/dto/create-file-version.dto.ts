import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateFileVersionDto {
  @IsString()
  @IsNotEmpty()
  url!: string;

  @IsNumber()
  @IsNotEmpty()
  fileSize!: number;

  @IsString()
  @IsNotEmpty()
  changeLog!: string; // 🌟 บังคับใส่เพื่อให้รู้ว่าเวอร์ชันนี้แก้เรื่องอะไร

  // 🔍 [Future Feature] รองรับการเก็บข้อความที่สกัดจาก OCR/AI เพื่อทำ Full-Text Search
  @IsOptional()
  @IsString()
  extractedText?: string;

}