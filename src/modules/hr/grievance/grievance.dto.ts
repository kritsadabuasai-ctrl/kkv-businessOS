import { IsString, IsOptional, IsInt, IsEnum, IsBoolean, IsArray, IsDateString } from 'class-validator';
import { GrievanceSeverity, GrievanceStatus } from '@prisma/client';

// --- Master: ประเภทการร้องเรียน ---
export class CreateGrievanceTypeDto {
  @IsString() code!: string; // เช่น HARASSMENT, UNFAIR
  @IsString() name!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsBoolean() isConfidential?: boolean;
}

// --- Transaction: การส่งคำร้องเรียน/อุทธรณ์ ---
export class CreateGrievanceTicketDto {
  @IsInt() typeId!: number;
  @IsOptional() @IsInt() requesterId?: number; // Null ได้ถ้าเป็น Anonymous 
  @IsOptional() @IsBoolean() isAnonymous?: boolean;
  @IsOptional() @IsInt() accusedId?: number; // คู่กรณี [cite: 1441]
  @IsOptional() @IsInt() refDisciplinaryActionId?: number; // กรณีอุทธรณ์โทษ 
  @IsString() subject!: string;
  @IsString() description!: string;
  @IsEnum(GrievanceSeverity) severity!: GrievanceSeverity;
  @IsOptional() @IsDateString() incidentDate?: string;
  @IsArray() @IsString({ each: true }) evidenceUrls!: string[];
}

// --- Admin: การสรุปผลการพิจารณา ---
export class ResolveGrievanceDto {
  @IsEnum(GrievanceStatus) status!: GrievanceStatus;
  @IsString() resolutionSummary!: string;
}