import { IsInt, IsOptional, IsString, IsDateString, IsNumber } from 'class-validator';

export class CreateShareLinkDto {
  @IsInt()
  fileId!: number;

  @IsOptional()
  @IsString()
  password?: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @IsOptional()
  @IsNumber()
  maxDownloads?: number;
}