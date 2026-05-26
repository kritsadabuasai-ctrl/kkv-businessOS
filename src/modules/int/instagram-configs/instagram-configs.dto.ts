import { IsString, IsOptional, IsBoolean, IsInt } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateInstagramConfigDto {
  @IsString()
  igAccountId!: string;

  @IsOptional()
  @IsString()
  igUsername?: string;

  @IsString()
  accessToken!: string;

  @IsOptional()
  @IsBoolean()
  isAiEnabled?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  aiBotId?: number;
}

export class UpdateInstagramConfigDto extends CreateInstagramConfigDto {}