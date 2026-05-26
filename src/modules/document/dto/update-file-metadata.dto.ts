import { IsArray, IsBoolean, IsNotEmpty, IsString, ValidateNested,IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

class MetadataItemDto {
  @IsString()
  @IsNotEmpty()
  key!: string;

  @IsString()
  @IsNotEmpty()
  value!: string;
}

export class UpdateFileMetadataDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MetadataItemDto)
  metadata!: MetadataItemDto[];

  // 🚨 [Future] อัปเดตสถานะความปลอดภัยของไฟล์ภายหลัง
  @IsOptional()
  @IsBoolean()
  isSensitiveData?: boolean;
}