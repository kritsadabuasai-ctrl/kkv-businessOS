import { IsString, IsNotEmpty, IsOptional, IsInt, IsBoolean, IsObject } from 'class-validator';

// 1. DTO สำหรับตาราง CfgMasterGroup (หัวข้อกลุ่มข้อมูล)
export class CreateMasterGroupDto {
  @IsString()
  @IsNotEmpty()
  groupCode: string; // ✅ เปลี่ยนจาก 'code' เป็น 'groupCode' ตาม Schema 

  @IsString()
  @IsNotEmpty()
  groupName: string; // ✅ เปลี่ยนจาก 'name' เป็น 'groupName' ตาม Schema 

  @IsOptional()
  @IsString()
  description?: string;
}

// 🌟 [เพิ่มใหม่] DTO สำหรับการอัปเดตกลุ่มข้อมูล (ห้ามแก้ groupCode)
export class UpdateMasterGroupDto {
  @IsOptional()
  @IsString()
  groupName?: string;

  @IsOptional()
  @IsString()
  description?: string;
}

// 2. DTO สำหรับตาราง CfgMasterData (ตัวเลือกข้อมูลภายในกลุ่ม)
export class CreateMasterDataDto {
  @IsInt()
  @IsNotEmpty()
  masterGroupId: number; // ✅ ชื่อฟิลด์ FK ตาม Schema 

  @IsString()
  @IsNotEmpty()
  code: string; // รหัสตัวเลือก เช่น 'MR', 'MS' 

  @IsString()
  @IsOptional()
  name?: string; // ชื่อที่แสดงผลทั่วไป 

  @IsObject()
  @IsNotEmpty()
  labels: any; // ✅ เพิ่มเพื่อรองรับ JSON หลายภาษาตาม Schema { "th": "นาย", "en": "Mr." } 

  @IsOptional()
  @IsInt()
  parentId?: number; // ✅ เพิ่มสำหรับ Master Data แบบลำดับชั้น (Tree)

  @IsOptional()
  @IsInt()
  sortOrder?: number; // ลำดับการแสดงผล

  @IsOptional()
  @IsInt()
  companyId?: number; // 👈 เพิ่มตัวนี้เข้าไปครับ

  
}

export class UpdateMasterDataDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsObject() labels?: any;
  @IsOptional() @IsInt() sortOrder?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}