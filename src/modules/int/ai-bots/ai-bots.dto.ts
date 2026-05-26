import { IsString, IsOptional, IsBoolean, IsNumber, Min } from 'class-validator';

export class CreateAiBotDto {
  @IsOptional()
  @IsString()
  code?: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  provider?: string; // GEMINI, OPENAI

  @IsOptional()
  @IsString()
  modelName?: string; // gemini-1.5-flash

  @IsOptional()
  @IsNumber()
  temperature?: number;

  @IsOptional()
  @IsString()
  systemPrompt?: string;

  @IsOptional()
  @IsString()
  greetingMessage?: string;

  @IsOptional()
  @IsBoolean()
  canUseTools?: boolean;

  // ✅ เพิ่มฟิลด์นี้ (แก้ Error: Property 'isActive' does not exist)
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  isSystem?: boolean;
}

export class UpdateAiBotDto {
  // ✅ เพิ่มฟิลด์ code ตรงนี้ครับ เพื่อให้ระบบอนุญาตให้หน้าบ้านส่งมาแก้ไขได้
  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  provider?: string;

  @IsOptional()
  @IsString()
  modelName?: string;

  @IsOptional()
  @IsNumber()
  temperature?: number;

  @IsOptional()
  @IsString()
  systemPrompt?: string;

  @IsOptional()
  @IsString()
  greetingMessage?: string;

  @IsOptional()
  @IsBoolean()
  canUseTools?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  isSystem?: boolean;
}

export class UpdateQuotaDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  monthlyLimit?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxStorageBytes?: number;

  @IsOptional()
  @IsBoolean()
  canUseTools?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  // ✅ เพิ่มฟิลด์นี้ (แก้ Error: Property 'extraCredit' does not exist)
  @IsOptional()
  @IsNumber()
  @Min(0)
  extraCredit?: number;
}