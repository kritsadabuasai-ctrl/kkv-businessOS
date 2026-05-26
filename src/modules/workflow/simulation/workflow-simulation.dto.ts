import { IsNumberString, IsOptional } from 'class-validator';

export class WorkflowSimulationQueryDto {
  @IsNumberString()
  workflowId!: string;

  @IsNumberString()
  @IsOptional()
  requesterId?: string; // ถ้าไม่ส่งมา อาจจะใช้ ID ของคนที่ Login อยู่เป็นตัวจำลอง
}