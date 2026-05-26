import { IsInt, IsOptional, IsString } from 'class-validator';

export class CreateRedemptionDto {
  @IsInt()
  companyId: number;

  // 🌟 เพิ่ม shopId
  @IsOptional()
  @IsInt()
  shopId?: number;

  @IsInt()
  memberId: number;

  @IsInt()
  rewardId: number;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  redeemCode?: string;
}