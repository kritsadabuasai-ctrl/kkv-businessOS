import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { NotificationType } from '@prisma/client';

export class CreateNotificationDto {
  @IsEnum(NotificationType)
  @IsNotEmpty()
  type!: NotificationType; // ORDER_UPDATE, PROMOTION, SYSTEM, REWARD

  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsNotEmpty()
  message!: string;

  @IsInt()
  @IsOptional()
  recipientMemberId?: number; // ส่งให้ลูกค้า

  @IsInt()
  @IsOptional()
  recipientUserId?: number; // ส่งให้แอดมิน

  @IsString()
  @IsOptional()
  iconUrl?: string;

  @IsString()
  @IsOptional()
  actionUrl?: string; // ลิงก์เมื่อกดแจ้งเตือน

  @IsInt()
  @IsOptional()
  announcementId?: number; // ID ของประกาศที่เกี่ยวข้อง
}