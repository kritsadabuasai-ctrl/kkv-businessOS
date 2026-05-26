import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateTemplateDto {
  @IsString()
  @IsNotEmpty()
  code!: string; // เช่น 'WELCOME_EMAIL', 'ORDER_CONFIRM' 

  @IsString()
  @IsNotEmpty()
  channel!: string; // เช่น 'EMAIL', 'LINE', 'SMS' 

  @IsString()
  @IsOptional()
  locale?: string; // 'th', 'en' (Default: 'th') 

  @IsString()
  @IsOptional()
  subject?: string; // หัวข้อ (สำหรับ Email) 

  @IsString()
  @IsNotEmpty()
  content!: string; // เนื้อหาต้นแบบ (รองรับ Variable เช่น {{name}}) 
}

export class UpdateTemplateDto {
  @IsOptional() @IsString() subject?: string;
  @IsOptional() @IsString() content?: string;
}