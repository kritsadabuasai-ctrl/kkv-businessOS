import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsNumber, ValidateNested, IsArray, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';

export enum ShippingCalcType {
  PRICE_BASED = 'PRICE_BASED',
  WEIGHT_BASED = 'WEIGHT_BASED',
  FLAT_RATE = 'FLAT_RATE',
}

export class ShippingRuleDto {
  @IsNumber() @IsOptional() id?: number;

  @IsNumber() @IsOptional() minAmount?: number;
  @IsNumber() @IsOptional() maxAmount?: number;

  @IsNumber() @IsOptional() minWeight?: number; 
  @IsNumber() @IsOptional() maxWeight?: number;

  @IsString() @IsOptional() boxSize?: string;

  @IsNumber() @IsNotEmpty() cost!: number;
}

export class CreateShippingMethodDto {
  // 🛡️ เอา companyId ออกจากที่นี่
  
  @IsString() @IsNotEmpty() name!: string;
  @IsString() @IsOptional() description?: string;
  @IsBoolean() @IsOptional() isActive?: boolean;

  @IsOptional()
  @IsEnum(ShippingCalcType)
  calcType?: ShippingCalcType; 

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ShippingRuleDto)
  @IsOptional()
  rules?: ShippingRuleDto[];
}