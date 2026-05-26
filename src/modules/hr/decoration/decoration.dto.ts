import { IsString, IsOptional, IsInt, IsDateString, IsBoolean, IsEnum } from 'class-validator';
import { DecorationReturnStatus } from '@prisma/client';

// --- Master: ชั้นตราเครื่องราชฯ ---
export class CreateDecorationClassDto {
  @IsString() code!: string; 
  @IsString() name!: string; 
  @IsInt() classLevel!: number; // ลำดับชั้นตรา 
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsBoolean() isReturnRequired?: boolean;
}

// --- Transaction: บันทึกการได้รับเครื่องราชฯ ---
export class CreateDecorationRecordDto {
  @IsInt() employeeId!: number;
  @IsInt() decorationId!: number;
  @IsOptional() @IsDateString() gazetteDate?: string; // วันที่ประกาศราชกิจจาฯ 
  @IsOptional() @IsString() gazetteVolume?: string; // เล่มที่
  @IsOptional() @IsString() gazettePart?: string; // ตอนที่
  @IsOptional() @IsString() gazettePage?: string; // หน้าที่ [cite: 1370]
  @IsOptional() @IsDateString() receivedDate?: string; // วันที่รับจริง [cite: 1371]
  @IsOptional() @IsEnum(DecorationReturnStatus) returnStatus?: DecorationReturnStatus;
  @IsOptional() @IsDateString() returnedDate?: string; // วันที่ส่งคืน [cite: 1372]
  @IsOptional() @IsString() documentUrl?: string;
  @IsOptional() @IsString() remark?: string;
}