import { IsBoolean, IsOptional, IsInt, IsString, Min } from 'class-validator';

export class CreateCrmConfigDto {
  @IsInt()
  @IsOptional()
  companyId?: number; // จะถูกเติมจาก Controller [cite: 102]

  @IsBoolean()
  @IsOptional()
  isPointEnabled?: boolean; // เปิด/ปิดระบบแต้ม 

  @IsInt()
  @Min(1)
  @IsOptional()
  earnRatio?: number; // เช่น 100 บาท ได้ 1 แต้ม 

  @IsInt()
  @IsOptional()
  pointExpiryMonths?: number; // อายุแต้ม (เดือน) 

  @IsString()
  @IsOptional()
  pointName?: string; // เช่น "Point", "Coins" 
}