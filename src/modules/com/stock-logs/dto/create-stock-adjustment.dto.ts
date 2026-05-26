import { IsNotEmpty, IsInt, IsString, IsOptional, IsEnum, IsNumber } from 'class-validator';

export enum StockAdjustmentType {
  ADJUSTMENT = 'ADJUSTMENT', 
  WASTE = 'WASTE' 
}

export class CreateStockAdjustmentDto {
  @IsInt()
  @IsNotEmpty()
  productId!: number;

  @IsInt()
  @IsNotEmpty()
  changeQty!: number; 

  @IsNumber()
  @IsNotEmpty()
  warehouseId!: number;

  @IsEnum(StockAdjustmentType)
  @IsNotEmpty()
  type!: StockAdjustmentType;

  @IsString()
  @IsOptional()
  note?: string;
}