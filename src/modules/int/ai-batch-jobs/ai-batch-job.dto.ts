import { IsString, IsNotEmpty, IsOptional, IsInt, IsObject } from 'class-validator';

export class CreateAiBatchJobDto {
  @IsString()
  @IsNotEmpty()
  jobType!: string; // เช่น "KNOWLEDGE_BASE_UPLOAD"

  @IsInt()
  @IsNotEmpty()
  totalItems!: number; // จำนวนไฟล์ที่เลือก

  @IsOptional()
  @IsObject()
  payload?: any; // เก็บ JSON ข้อมูลไฟล์ เช่น { files: [{ id: '...', name: '...' }] }

  @IsOptional()
  @IsString()
  errorSummary?: string;
}