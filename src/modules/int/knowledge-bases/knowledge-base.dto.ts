import { IsString, IsNotEmpty, IsOptional, IsEnum, IsInt, IsNumber, IsBoolean } from 'class-validator';
import { KnowledgeSourceType } from '@prisma/client';

export class CreateKnowledgeDto {
  @IsInt()
  @IsNotEmpty()
  companyId!: number;
  
  @IsString()
  @IsOptional() // เปลี่ยนเป็น Optional เพราะถ้ามาจาก Drive เราจะ Auto-gen ให้
  topic?: string;

  @IsString()
  @IsOptional()
  content?: string;

  @IsEnum(KnowledgeSourceType)
  sourceType!: KnowledgeSourceType;

  // --- Fields สำหรับไฟล์ (Local & Drive) ---
  @IsOptional()
  @IsString()
  fileId?: string;

  @IsOptional()
  @IsString()
  fileName?: string;

  @IsOptional()
  @IsString()
  url?: string;      // ✅ เพิ่ม: รับ URL ไฟล์

  @IsOptional()
  @IsString()
  mimeType?: string; // ✅ เพิ่ม: รับประเภทไฟล์

  @IsOptional()
  @IsNumber()
  size?: number;     // ✅ เพิ่ม: รับขนาดไฟล์ (Bytes)

  @IsOptional()
  @IsString()
  description?: string; // ✅ เพิ่ม: คำอธิบายเพิ่มเติม

  @IsOptional()
  @IsInt()
  aiBotId?: number;

  // ✅ เพิ่มบรรทัดนี้ เพื่อให้ Validation ยอมรับค่า processInQueue จาก Frontend แบบไม่ติด 400
  @IsOptional()
  @IsBoolean()
  processInQueue?: boolean;
}

export class UpdateKnowledgeDto extends CreateKnowledgeDto {}