import { IsNotEmpty, IsInt, IsString, Min } from 'class-validator';

export class CreateManpowerRequestDto {
  // 🏢 ไม่ต้องรับ companyId จากหน้าบ้าน เพราะเราจะดึงจาก Token เพื่อความปลอดภัย (Data Isolation)

  @IsNotEmpty({ message: 'กรุณาระบุแผนกที่ต้องการขออัตรากำลัง' })
  @IsInt()
  departmentId!: number;

  @IsNotEmpty({ message: 'กรุณาระบุตำแหน่งที่ต้องการขอเพิ่ม' })
  @IsInt()
  positionId!: number;

  @IsNotEmpty()
  @IsInt()
  @Min(1, { message: 'จำนวนอัตราที่ขอต้องระบุอย่างน้อย 1 อัตรา' })
  requestedCount!: number;

  @IsNotEmpty({ message: 'กรุณาระบุเหตุผลในการขออัตรากำลังเพื่อประกอบการพิจารณา' })
  @IsString()
  reason!: string;
}