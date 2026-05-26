import { IsInt, IsString, IsOptional, IsDate } from 'class-validator';
import { Type } from 'class-transformer';

// 1. DTO สำหรับสร้างการมอบหมายสิทธิ์
export class CreateDelegationDto {
  @IsInt()
  delegateUserId!: number; // ฝากสิทธิ์ให้ใคร (User ID)

  // ✅ เปลี่ยนจาก @IsDateString() เป็น @IsDate() และใช้ @Type() 
  // เพื่อให้ NestJS แปลง string จากหน้าบ้านเป็น Date Object ให้ทันทีในระดับ DTO
  @Type(() => Date)
  @IsDate()
  startDate!: Date;

  @Type(() => Date)
  @IsDate()
  endDate!: Date;

  @IsOptional()
  @IsString()
  reason?: string; // เหตุผล (เช่น ลาพักร้อน)
}

// 2. DTO สำหรับแก้ไข
export class UpdateDelegationDto {
  // ✅ ใช้การสืบทอดบางส่วน หรือเขียนแยกเพื่อความชัดเจน
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  startDate?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  endDate?: Date;

  @IsOptional()
  @IsString()
  reason?: string;
}