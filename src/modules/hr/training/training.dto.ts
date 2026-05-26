import { IsString, IsOptional, IsInt, IsEnum, IsDateString, IsDecimal, IsBoolean, IsArray } from 'class-validator';
import { TrainingSessionStatus, EnrollmentStatus } from '@prisma/client';

// --- Master: Training Course ---
export class CreateCourseDto {
  @IsString() code!: string; // เช่น TR-LEAD-01 
  @IsString() name!: string; // 
  @IsOptional() @IsString() description?: string; // 
  @IsOptional() @IsString() category?: string; // เช่น Soft Skills [cite: 630]
  @IsOptional() @IsDecimal() creditHours?: number; // [cite: 630]
}

// --- Transaction: Training Session (รอบการจัด) ---
export class CreateSessionDto {
  @IsInt() courseId!: number; // [cite: 631]
  @IsInt() calendarYear!: number; // [cite: 631]
  @IsString() batchName!: string; // เช่น รุ่นที่ 1/2569 [cite: 632]
  @IsOptional() @IsString() location?: string; // [cite: 632]
  @IsOptional() @IsString() instructor?: string; // [cite: 633]
  @IsDateString() startDate!: string; // [cite: 631]
  @IsDateString() endDate!: string; // [cite: 631]
  @IsOptional() @IsInt() capacity?: number; // [cite: 634]
  @IsOptional() @IsDecimal() budget?: number; // [cite: 635]
}

// --- Transaction: Enrollment (ลงทะเบียน/บันทึกผล) ---
export class EnrollEmployeeDto {
  @IsInt() sessionId!: number; // 
  @IsArray() @IsInt({ each: true }) employeeIds!: number[]; // ลงทะเบียนทีละหลายคน
}

export class UpdateResultDto {
  @IsEnum(EnrollmentStatus) status!: EnrollmentStatus; // [cite: 628]
  @IsOptional() @IsDecimal() preTestScore?: number; // [cite: 638]
  @IsOptional() @IsDecimal() postTestScore?: number; // [cite: 638]
  @IsOptional() @IsBoolean() isPassed?: boolean; // [cite: 639]
  @IsOptional() @IsString() certificateUrl?: string; // [cite: 639]
}