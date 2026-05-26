import { IsOptional, IsString, IsEnum } from 'class-validator';
import { HolidayGroupStatus } from '@prisma/client'; // ดึง Enum มาจาก Prisma Schema ที่เราตั้งไว้

export class UpdateOrgVersionDto {
  @IsOptional()
  @IsString()
  name?: string; // เผื่อต้องการแก้ชื่อ Version

  @IsOptional()
  @IsEnum(HolidayGroupStatus, {
    message: 'สถานะต้องเป็น DRAFT, PUBLISHED หรือ ARCHIVED เท่านั้น'
  })
  status?: HolidayGroupStatus; // ใช้คุม State ว่าพร้อมใช้งานจริงหรือยัง
}