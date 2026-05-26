import { 
  IsString, 
  IsInt, 
  IsOptional, 
  IsBoolean, 
  IsArray, 
  ValidateNested, 
  IsEmail 
} from 'class-validator';
import { Type } from 'class-transformer';

// -------------------------------------------------------
// 📄 DTO ย่อยสำหรับรับข้อมูล "เอกสารของบริษัท" (Company Documents)
// -------------------------------------------------------
export class CompanyDocumentDto {
  @IsInt()
  mediaId!: number; // ID จากตาราง SysMedia ที่อัปโหลดเสร็จแล้ว

  @IsString()
  documentType!: string; // ประเภทเอกสาร เช่น 'DBD' (หนังสือรับรอง), 'PP20' (ภ.พ.20)
  
  @IsOptional()
  @IsString()
  documentNumber?: string; // (ถ้ามี) เลขที่เอกสารอ้างอิง
}

// -------------------------------------------------------
// 🏢 DTO สำหรับการสร้างบริษัทใหม่ (Create)
// -------------------------------------------------------
export class CreateCompanyDto {
  // --- ข้อมูลหลักของบริษัท (OrgCompany) ---
  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsInt()
  parentId?: number;

  @IsOptional()
  @IsString()
  companyType?: string;

  @IsOptional()
  @IsInt()
  packageId?: number;

  @IsOptional()
  @IsBoolean()
  isReseller?: boolean;

  // --- ข้อมูลธีมและการแสดงผล (Theme & UI) ---
  @IsOptional()
  @IsString()
  primaryColor?: string;

  @IsOptional()
  @IsString()
  secondaryColor?: string;

  @IsOptional()
  @IsString()
  buttonColor?: string;

  @IsOptional()
  @IsString()
  fontFamily?: string;

  @IsOptional()
  @IsString()
  fontHeadingFamily?: string;

  @IsOptional()
  @IsInt()
  fontSizeBase?: number;

  // 🌐 โดเมนเฉพาะสำหรับหน้าระบบจัดการหลังบ้าน
  @IsOptional()
  @IsString()
  customDomain?: string;

  // --- ข้อมูลนิติบุคคลและการติดต่อ (OrgCompanyInfo) ---
  @IsOptional()
  @IsInt()
  logoMediaId?: number; // 🖼️ ผูกรูปโลโก้กับ DMS

  @IsOptional()
  @IsString()
  taxId?: string;

  @IsOptional()
  @IsString()
  branchCode?: string;

  @IsOptional()
  @IsString()
  registeredName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  fax?: string;

  @IsOptional()
  @IsString()
  website?: string;

  // --- ข้อมูลที่อยู่ (Address) ---
  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  subDistrict?: string;

  @IsOptional()
  @IsString()
  district?: string;

  @IsOptional()
  @IsString()
  province?: string;

  @IsOptional()
  @IsString()
  zipCode?: string;

  // --- 📂 เอกสารนิติบุคคล (เชื่อมโยงกับ OrgCompanyDocument) ---
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CompanyDocumentDto)
  documents?: CompanyDocumentDto[];
}

// -------------------------------------------------------
// 📝 DTO สำหรับการอัปเดตบริษัท (Update)
// -------------------------------------------------------
// คัดลอก Structure มาจาก Create แต่ทำให้ทุกฟิลด์กลายเป็น Optional
import { PartialType } from '@nestjs/mapped-types'; // หรือ '@nestjs/swagger' ถ้าคุณใช้ Swagger

export class UpdateCompanyDto extends PartialType(CreateCompanyDto) {}