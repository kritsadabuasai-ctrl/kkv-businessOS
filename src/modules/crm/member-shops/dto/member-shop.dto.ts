import { IsInt, IsOptional, IsString, IsNumber } from 'class-validator';

export class UpdateMemberShopDto {
  @IsNumber()
  @IsOptional()
  pointBalance?: number;

  @IsString()
  @IsOptional()
  memberLevelCode?: string;
}

export class MemberShopQueryDto {
  @IsInt()
  @IsOptional()
  shopId?: number;

  @IsInt()
  @IsOptional()
  memberId?: number;
}