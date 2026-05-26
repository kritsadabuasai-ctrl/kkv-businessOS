import { IsString, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';

export class CreateLineConfigDto {
  @IsString()
  @IsNotEmpty()
  channelName!: string;

  @IsString()
  @IsNotEmpty()
  channelId!: string;

  @IsString()
  @IsNotEmpty()
  channelSecret!: string;

  @IsString()
  @IsNotEmpty()
  channelToken!: string;

  // ✅ ตรงกับ Schema
  @IsString()
  @IsOptional()
  liffIdMain?: string;

  @IsString()
  @IsOptional()
  aiBotCode?: string;

  // ✅ รองรับทั้ง isAiEnabled และ enableAiReply (เผื่อหน้าบ้านส่งมาแบบไหนก็รับได้)
  @IsBoolean()
  @IsOptional()
  isAiEnabled?: boolean;
  
  @IsBoolean()
  @IsOptional()
  enableAiReply?: boolean; 
}

export class UpdateLineConfigDto extends CreateLineConfigDto {}