import { IsString, IsInt, IsOptional, IsEmail, IsNumber, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateSignatureRequestDto {
  @ApiProperty({ description: 'อีเมลผู้เซ็น (ทั้งคนในและคนนอก)' })
  @IsEmail()
  signerEmail!: string;

  @ApiProperty({ description: 'ชื่อผู้เซ็น' })
  @IsString()
  signerName!: string;

  @ApiProperty({ description: 'รหัสพนักงาน/ผู้ใช้ (ถ้ามี)', required: false })
  @IsOptional()
  @IsInt()
  signerId?: number;

  @ApiProperty({ description: 'เลขหน้าเอกสารที่จะให้เซ็น', default: 1 })
  @IsInt()
  @Min(1)
  pageNumber!: number;

  @ApiProperty({ description: 'ตำแหน่งแนวแกน X (พิกัดหรือ %)' })
  @IsNumber()
  posX!: number;

  @ApiProperty({ description: 'ตำแหน่งแนวแกน Y' })
  @IsNumber()
  posY!: number;

  @ApiProperty({ description: 'ผูกกับ Workflow Request ID (ถ้ามี)', required: false })
  @IsOptional()
  @IsInt()
  wfRequestId?: number;
}