import { IsNotEmpty, IsInt, IsString, IsOptional } from 'class-validator';

export class CopyOrgStructureDto {
  @IsNotEmpty()
  @IsInt()
  newCalendarId!: number; // ID ของปฏิทินปีงบประมาณเป้าหมายที่ต้องการเอาผังไปวาง

  @IsNotEmpty()
  @IsString()
  name!: string; // ชื่อของผังจำลองตัวใหม่ เช่น "โครงสร้างปีงบประมาณ 2569 (Draft)"

  @IsOptional()
  @IsInt()
  version?: number; // ลำดับ Version ของปีนั้นๆ (ถ้าหน้าบ้านไม่ส่งมา Service จะให้ default เป็น 1)
}