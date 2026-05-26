import { IsString, IsInt, IsOptional, IsEnum } from 'class-validator';

export class SendMessageDto {
  @IsString() channel!: string;     // เช่น 'LINE', 'FACEBOOK', 'WEBCHAT'
  @IsString() senderId!: string;    // ไอดีลูกค้า (เช่น Line User ID)
  
  @IsOptional()
  @IsString() senderName?: string; // ชื่อลูกค้า (ถ้ามี)

  @IsString() senderType!: string;  // 'CUSTOMER', 'AGENT', 'AI'
  @IsString() messageType!: string; // 'TEXT', 'IMAGE', 'FILE'
  @IsString() content!: string;     // เนื้อหาข้อความ

  @IsOptional() metadata?: any;    // ข้อมูลพิกัด หรือ Raw Data จาก Webhook
}