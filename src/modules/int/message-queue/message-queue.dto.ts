import { IsString, IsNotEmpty, IsOptional, IsInt, IsDateString } from 'class-validator';

export class CreateMessageQueueDto {
  @IsString()
  @IsNotEmpty()
  channel!: string; // LINE, SMS, EMAIL

  @IsString()
  @IsNotEmpty()
  recipient!: string;

  @IsString()
  @IsNotEmpty()
  content!: string;

  @IsDateString()
  @IsNotEmpty()
  scheduledTime!: string; // เวลาที่ต้องการให้ส่ง

  @IsOptional()
  @IsString()
  subject?: string; // สำหรับ Email

  @IsOptional()
  @IsString()
  refType?: string;

  @IsOptional()
  @IsString()
  refId?: string;
}