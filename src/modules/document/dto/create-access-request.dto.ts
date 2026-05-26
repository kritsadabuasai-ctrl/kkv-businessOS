import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

// สร้าง Enum เพื่อจำกัดให้ส่งมาแค่ 2 ค่านี้เท่านั้น
export enum AccessTargetType {
  FOLDER = 'FOLDER',
  FILE = 'FILE',
}

export class CreateAccessRequestDto {
  @IsEnum(AccessTargetType)
  @IsNotEmpty()
  targetType!: AccessTargetType; // ระบุว่าเป็น FOLDER หรือ FILE

  @IsInt()
  @IsNotEmpty()
  targetId!: number; // ID ของโฟลเดอร์หรือไฟล์นั้นๆ

  @IsOptional()
  @IsString()
  reason?: string; // เหตุผลที่ขอเข้าดู (หน้าบ้านควรบังคับกรอก)

  @IsOptional()
  @IsInt()
  @Min(1)
  durationDays?: number; // จำนวนวันที่ขอสิทธิ์ (ถ้าไม่ส่งมา เดี๋ยวหลังบ้านตั้ง Default เป็น 1 วัน)
}