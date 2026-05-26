import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsInt, IsNumber, IsArray, IsEnum, ValidateNested, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { RoundingType } from '@prisma/client'; // ✅ Import Enum จาก Prisma

export class RoundingRangeDto {
  @IsNumber()
  minVal: number;

  @IsNumber()
  maxVal: number;

  @IsNumber()
  result: number;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class CreateRoundingRuleDto {
  @IsString()
  @IsNotEmpty()
  code: string; // เช่น "R_001"

  @IsString()
  @IsNotEmpty()
  name: string; // เช่น "ปัดเศษทศนิยม 2 ตำแหน่ง"

  @IsEnum(RoundingType)
  @IsOptional()
  type?: RoundingType; // WHOLE, DIGIT

  @IsOptional()
  @IsInt()
  @Min(0)
  digitIndex?: number; // ใช้เฉพาะเมื่อ type = DIGIT

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  // ✅ รับเป็น Array เพื่อสร้าง Ranges ทีเดียว
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RoundingRangeDto)
  ranges?: RoundingRangeDto[];
}

export class UpdateRoundingRuleDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsEnum(RoundingType) type?: RoundingType;
  @IsOptional() @IsInt() digitIndex?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;

  // ✅ ถ้าส่ง ranges มา จะถือว่า "ลบของเก่าแล้วสร้างใหม่" (Reset Ranges)
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RoundingRangeDto)
  ranges?: RoundingRangeDto[];
}