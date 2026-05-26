import { 
  IsString, 
  IsNotEmpty, 
  IsOptional, 
  IsInt, 
  IsBoolean, 
  IsDateString, 
  IsArray,
  ValidateNested
} from 'class-validator';
import { Type } from 'class-transformer';

// 📄 DTO ย่อยสำหรับโครงสร้างข้อมูลไฟล์สื่อแต่ละไฟล์
export class AnnouncementMediaInputDto {
  @IsInt()
  mediaId!: number; // ID จากตาราง SysMedia

  @IsOptional()
  @IsString()
  mediaType?: string; // ประเภท เช่น 'BANNER_IMAGE', 'ATTACHMENT_PDF'
}

export class CreateAnnouncementDto {
  @IsOptional()
  @IsInt()
  companyId?: number; // คอนโทรลเลอร์จะแนบค่านี้ให้จาก Token

  @IsNotEmpty({ message: 'กรุณาระบุหัวข้อประกาศ' })
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsString()
  linkUrl?: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsString()
  position?: string;

  @IsOptional()
  @IsInt()
  displayOrder?: number;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  shopIds?: number[];

  // 📁 รองรับการแนบไฟล์และสื่อหลายรายการพร้อมระบุประเภท
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AnnouncementMediaInputDto)
  media?: AnnouncementMediaInputDto[];
}