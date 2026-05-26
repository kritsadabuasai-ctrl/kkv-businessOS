import { IsNotEmpty, IsOptional, IsInt, IsNumber, IsString } from 'class-validator';

export class CreateShippingRuleDto {
  @IsInt()
  @IsNotEmpty()
  methodId: number;

  @IsNumber()
  @IsOptional() 
  minAmount?: number;

  @IsNumber()
  @IsOptional()
  maxAmount?: number;

  @IsNumber()
  @IsOptional()
  minWeight?: number;

  @IsNumber()
  @IsOptional()
  maxWeight?: number;

  // 🌟 [เพิ่มใหม่] รองรับการส่งขนาดกล่อง
  @IsString()
  @IsOptional()
  boxSize?: string;

  @IsNumber()
  @IsNotEmpty()
  cost: number;
}