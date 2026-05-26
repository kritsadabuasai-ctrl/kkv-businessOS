import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsJSON } from 'class-validator';

export class CreateCloudConfigDto {
  @IsString()
  @IsNotEmpty()
  provider!: string; // เช่น "GOOGLE_DRIVE", "AWS_S3" 

  @IsString()
  @IsNotEmpty()
  configName!: string; // ชื่อเรียกเพื่อให้ User จำได้ เช่น "Drive_ฝ่ายบัญชี" 

  @IsString()
  @IsNotEmpty()
  // ✅ รับค่าเป็น JSON String (เช่นเนื้อหาในไฟล์ Service Account)
  @IsJSON()
  configData!: string; //[cite: 13]

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateCloudConfigDto {
  @IsOptional() @IsString() configName?: string;
  @IsOptional() @IsString() configData?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}