import { IsInt, IsNotEmpty, IsOptional, IsString, IsJSON } from 'class-validator';

export class CreateWfRequestDto {
  @IsString()
  @IsNotEmpty()
  moduleCode!: string; // ส่งรหัสโมดูลมา เช่น 'HR_LEAVE' ระบบจะไปหา WorkflowId ให้เอง

  @IsString()
  @IsNotEmpty()
  businessId!: string; // ID เอกสารต้นทาง เช่น 'LEAVE-001'

  @IsString()
  @IsNotEmpty()
  topic!: string; // หัวข้อเรื่อง เช่น "ขอลาพักร้อน - กฤษฎา"

  @IsOptional()
  @IsJSON()
  data?: string; // Snapshot ข้อมูล ณ ตอนส่ง
}

export class UpdateWfRequestDto {
  @IsOptional()
  @IsString()
  topic?: string;

  @IsOptional()
  @IsJSON()
  data?: string;
}