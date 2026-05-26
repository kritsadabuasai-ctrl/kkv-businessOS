import { IsBoolean, IsOptional, IsString, IsInt } from 'class-validator';

export class UpdateMenuConfigDto {
  @IsOptional()
  @IsBoolean()
  showInSidebar?: boolean;

  @IsOptional()
  @IsBoolean()
  showInNavbar?: boolean;

  @IsOptional()
  @IsBoolean()
  isShortcut?: boolean;

  @IsOptional()
  @IsString()
  customLabel?: string;

  @IsOptional()
  @IsString()
  customIcon?: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}