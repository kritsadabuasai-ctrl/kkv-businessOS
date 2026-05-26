import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsObject } from 'class-validator';

export class CreateCmsPageDto {
  @IsString()
  @IsNotEmpty()
  slug!: string;

  @IsString()
  @IsOptional()
  title?: string;

  @IsObject() // 👈 สำหรับรับ JSON Layout จากเครื่องมือลากวาง
  @IsOptional()
  content?: any;

  @IsString()
  @IsOptional()
  seoTitle?: string;

  @IsString()
  @IsOptional()
  seoDescription?: string;

  @IsString()
  @IsOptional()
  seoImage?: string;

  @IsBoolean()
  @IsOptional()
  isPublished?: boolean;
}

export class UpdateCmsPageDto extends CreateCmsPageDto {}