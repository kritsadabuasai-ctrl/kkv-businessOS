import { IsString, IsEnum, IsOptional, IsInt, IsArray, IsDateString, IsBoolean } from 'class-validator';
import { OffenseSeverity, DisciplinaryStatus } from '@prisma/client';

// --- Master: Offense Type ---
export class CreateOffenseTypeDto {
  @IsString() code!: string;
  @IsString() name!: string;
  @IsEnum(OffenseSeverity) severity!: OffenseSeverity;
  @IsOptional() @IsString() description?: string;
}

// --- Master: Penalty Type ---
export class CreatePenaltyTypeDto {
  @IsString() code!: string;
  @IsString() name!: string;
  @IsOptional() @IsBoolean() isSuspension?: boolean;
  @IsOptional() @IsBoolean() isTermination?: boolean;
  @IsOptional() @IsString() description?: string;
}

// --- Transaction: Incident ---
export class CreateDisciplinaryIncidentDto {
  @IsInt() employeeId!: number; // ผู้กระทำผิด
  @IsInt() offenseTypeId!: number;
  @IsDateString() incidentDate!: string;
  @IsOptional() @IsString() location?: string;
  @IsString() description!: string;
  @IsOptional() @IsArray() @IsString({ each: true }) evidenceUrls?: string[];
}

export class UpdateDisciplinaryStatusDto {
  @IsEnum(DisciplinaryStatus) status!: DisciplinaryStatus;
}

// --- Transaction: Action (ลงโทษจริง) ---
export class CreateDisciplinaryActionDto {
  @IsInt() incidentId!: number;
  @IsInt() penaltyTypeId!: number;
  @IsOptional() @IsDateString() startDate?: string;
  @IsOptional() @IsDateString() endDate?: string;
  @IsOptional() @IsString() remark?: string;
}