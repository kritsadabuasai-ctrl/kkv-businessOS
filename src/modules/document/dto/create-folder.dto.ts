import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateFolderDto {
  @IsOptional()
  @IsInt()
  companyId?: number; // 🌟 ลบ @IsNotEmpty และเปลี่ยน ! เป็น ?

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  parentId?: number; 

  // 🌟 [เพิ่มใหม่] Flag เพื่อบอกว่าโฟลเดอร์นี้เป็น Workspace
  @IsOptional()
  @IsBoolean()
  isWorkspace?: boolean;

  // 🌟 [เพิ่มใหม่] ผูก Workflow อัตโนมัติ (Hot Folder)
  @IsOptional()
  @IsInt()
  defaultWorkflowId?: number;

  // 🌟 [เพิ่มใหม่ล่าสุด] สายอนุมัติสำหรับขอสิทธิ์เข้าถึง (Access Request)
  @IsOptional()
  @IsInt()
  accessWorkflowId?: number;

  @IsOptional()
  @IsInt()
  deleteWorkflowId?: number;

  // 💧 [Future Feature] สวิตช์เปิด/ปิดลายน้ำอัตโนมัติสำหรับไฟล์ในโฟลเดอร์นี้
  @IsOptional()
  @IsBoolean()
  isWatermarkEnabled?: boolean;
}