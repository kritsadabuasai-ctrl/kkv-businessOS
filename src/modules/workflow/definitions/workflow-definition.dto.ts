import { IsString, IsOptional, IsBoolean, IsNotEmpty } from 'class-validator';

/**
 * 📝 DTO สำหรับการสร้าง Workflow Definition ใหม่
 */
export class CreateWorkflowDefinitionDto {
  /// รหัสอ้างอิงของ Workflow เช่น "PO_APPROVE", "LEAVE_REQ"
  @IsString()
  @IsNotEmpty({ message: 'กรุณาระบุรหัส Workflow (Code)' })
  code!: string;

  /// ชื่อของกระบวนการ Workflow เช่น "อนุมัติใบสั่งซื้อ"
  @IsString()
  @IsNotEmpty({ message: 'กรุณาระบุชื่อ Workflow (Name)' })
  name!: string;

  /// รายละเอียดหรือคำอธิบายเพิ่มเติมเกี่ยวกับกระบวนการนี้
  @IsOptional()
  @IsString()
  description?: string;

  /// สถานะการใช้งาน (Default: true)
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

/**
 * 🔄 DTO สำหรับการแก้ไข Workflow Definition
 */
export class UpdateWorkflowDefinitionDto {
  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}