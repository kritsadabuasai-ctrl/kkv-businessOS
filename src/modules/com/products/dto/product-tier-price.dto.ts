import { IsDateString, IsOptional, IsString, IsBoolean, IsArray, ValidateNested, IsInt, IsNumber, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';

export class ProductTierItemDto {
  @IsInt()
  @IsNotEmpty()
  minQty!: number;

  @IsInt()
  @IsOptional()
  maxQty?: number;

  @IsNumber()
  @IsNotEmpty()
  unitPrice!: number;
}

export class CreateProductPriceSetDto {
  @IsDateString()
  @IsNotEmpty()
  effectiveFrom!: string;

  @IsDateString()
  @IsOptional()
  effectiveTo?: string;

  @IsString()
  @IsOptional()
  note?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductTierItemDto)
  tiers!: ProductTierItemDto[];
}