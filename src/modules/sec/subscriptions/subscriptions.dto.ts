import { IsArray, IsInt, IsNotEmpty , IsOptional , IsDateString, IsString, IsNumber} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateSubscriptionsDto {
  @IsArray() @IsInt({ each: true }) @IsNotEmpty() moduleIds!: number[];
  @IsOptional() @IsDateString() endDate?: string;

  // 💰 เพิ่มฟิลด์รับยอดเงินและประเภทราคา
  @IsOptional() @IsNumber() @Type(() => Number) paidAmount?: number;
  @IsOptional() @IsString() priceType?: string; // 'NORMAL' หรือ 'RESELLER'
}