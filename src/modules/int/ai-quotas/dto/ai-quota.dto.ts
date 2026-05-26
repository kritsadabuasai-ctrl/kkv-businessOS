import { IsString, IsInt, IsOptional, Min } from 'class-validator';

export class UpdateQuotaDto {
  @IsOptional()
  @IsString()
  tier?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  monthlyLimit?: number; 

  @IsOptional()
  @IsInt()
  @Min(0)
  extraCredit?: number;

  // ✅ [NEW] เพิ่มสำหรับจัดการพื้นที่
  @IsOptional()
  @IsInt()
  @Min(0)
  maxStorageBytes?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  maxSingleFileSize?: number;

  @IsOptional()
  @IsString()
  endDate?: string;
}