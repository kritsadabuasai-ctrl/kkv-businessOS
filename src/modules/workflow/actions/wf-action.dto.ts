import { IsInt, IsNotEmpty, IsString, IsOptional, IsEnum, IsBoolean } from 'class-validator';

export enum ActionType {
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
  COMMENT = 'COMMENT', // ขอข้อมูลเพิ่ม / คอมเมนต์เฉยๆ ไม่เปลี่ยนสถานะ
  CANCEL = 'CANCEL',
  SEND_BACK = 'SEND_BACK', // ตีกลับให้ไปแก้ไข
  RECALL = 'RECALL',       // ดึงเรื่องกลับมาแก้ไขเอง (สำหรับผู้อนุมัติ)
  AD_HOC_INVITE = 'AD_HOC_INVITE' // 🌟 [เพิ่มใหม่] เชิญคนนอกมาช่วยพิจารณา
}

export class CreateWfActionDto {
  @IsOptional() // ให้เป็น Optional เพื่อให้ ValidationPipe ไม่บล็อกตอนหน้าบ้านยิงมา (เพราะส่งผ่าน Path)
  @IsInt()
  requestId!: number;

  @IsEnum(ActionType)
  @IsNotEmpty()
  action!: ActionType;

  @IsString()
  @IsOptional()
  comment?: string;

  @IsString()
  @IsOptional()
  signatureData?: string; // 🌟 เพิ่มสำหรับรับข้อมูลลายเซ็น (Base64 หรือ Token)

  @IsString()
  @IsOptional()
  ipAddress?: string; // เก็บ IP ณ ขณะที่เซ็นเพื่อความปลอดภัย

  // 🌟 [เพิ่มใหม่] รหัส User ของคนที่เราต้องการเชิญมาให้ความเห็น
  @IsInt()
  @IsOptional()
  invitedUserId?: number;

  // 🌟 [เพิ่มใหม่] เพื่อบอกว่าคนที่เชิญมานี้ "บังคับว่าต้องรอเขาตอบก่อนไหม?"
  @IsOptional()
  @IsBoolean()
  isBlocking?: boolean;
}