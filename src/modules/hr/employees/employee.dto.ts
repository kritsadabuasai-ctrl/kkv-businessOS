import { 
  IsString, 
  IsInt, 
  IsOptional, 
  IsDateString, 
  IsEnum, 
  IsEmail, 
  IsNotEmpty 
} from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';
import { EmploymentStatus } from '@prisma/client';

// =========================================================
// 1. DTO สำหรับสร้างพนักงานใหม่ (Create)
// =========================================================
export class CreateEmployeeDto {
  @IsInt()
  @IsOptional() // Controller จะเติมให้จาก Token
  companyId?: number;

  @IsString()
  @IsOptional() // ถ้าไม่ส่งมา ระบบจะ Auto Gen ให้
  employeeCode?: string;

  @IsString()
  @IsOptional() // เลือกว่าจะใช้ Format ไหน (เช่น 'EMP', 'STAFF')
  runningCodeType?: string; 

  // --- ข้อมูลหลัก (HrEmployee) ---
  @IsString()
  @IsOptional()
  title?: string; // นาย, นาง, นางสาว

  @IsString()
  @IsNotEmpty()
  firstName!: string;

  @IsString()
  @IsNotEmpty()
  lastName!: string;

  @IsString()
  @IsOptional()
  nickName?: string;

  @IsEmail()
  @IsOptional()
  email?: string; // อีเมลบริษัท (สำหรับ Login)

  @IsString()
  @IsOptional()
  lineId?: string; // ✅ ใช้สำหรับติดต่อ (Add Friend)

  @IsDateString()
  joinDate!: string; // YYYY-MM-DD

  // 🌟 [NEW] เพิ่มฟิลด์ วันที่ผ่านโปร
  @IsDateString()
  @IsOptional()
  confirmDate?: string; 

  @IsOptional()
  @IsEnum(EmploymentStatus)
  status?: EmploymentStatus; // Default: PROBATION

  @IsString()
  @IsOptional()
  employmentType?: string; // เช่น 'FULL_TIME', 'PART_TIME' หรือรหัสจาก Master Data

  // --- การจ้างงาน & ตำแหน่ง (Employment) ---
  @IsInt()
  @IsOptional()
  departmentId?: number;

  @IsInt()
  @IsOptional()
  positionId?: number;

  @IsInt()
  @IsOptional()
  managerId?: number;

  @IsInt()
  @IsOptional()
  baseSalary?: number; // (Optional) ใช้บันทึกเงินเดือนตั้งต้น ถ้ามีตารางเก็บ

  
  // --- ข้อมูลส่วนตัว (HrEmployeeInfo) ---
  @IsString()
  @IsOptional()
  idCardNumber?: string;

  @IsString()
  @IsOptional()
  passportNo?: string;

  @IsDateString()
  @IsOptional()
  birthDate?: string;

  @IsString()
  @IsOptional()
  gender?: string;

  @IsString()
  @IsOptional()
  bloodGroup?: string;

  @IsString()
  @IsOptional()
  nationality?: string;

  @IsString()
  @IsOptional()
  religion?: string;

  // 🌟 [NEW] เพิ่มฟิลด์ สถานภาพสมรส
  @IsString()
  @IsOptional()
  maritalStatus?: string;

  // 🌟 [NEW] เพิ่มฟิลด์ สถานภาพทางทหาร (เผื่อไว้)
  @IsString()
  @IsOptional()
  militaryStatus?: string;

  // --- การติดต่อ (Contact) ---
  @IsString()
  @IsOptional()
  phone?: string; // เบอร์มือถือ (หลัก)

  @IsString()
  @IsOptional()
  personalEmail?: string;

  @IsString()
  @IsOptional()
  profileImageUrl?: string;

  @IsString()
  @IsOptional()
  emergencyContactName?: string;

  // 🌟 [NEW] เพิ่มฟิลด์ ความสัมพันธ์ผู้ติดต่อฉุกเฉิน
  @IsString()
  @IsOptional()
  emergencyContactRelationship?: string;

  @IsString()
  @IsOptional()
  emergencyContactPhone?: string;

  @IsString()
  @IsOptional()
  address?: string;

  // --- การเงิน (Financial) ---
  @IsString()
  @IsOptional()
  bankName?: string;

  @IsString()
  @IsOptional()
  bankAccountNo?: string;

  // 🌟 [NEW] เพิ่มฟิลด์ ชื่อบัญชีธนาคาร
  @IsString()
  @IsOptional()
  bankAccountName?: string;
}

// =========================================================
// 2. DTO สำหรับแก้ไข (Update) - ใช้ PartialType
// =========================================================
export class UpdateEmployeeDto extends PartialType(CreateEmployeeDto) {
  // 🌟 เพิ่มฟิลด์สำหรับระบุว่าเป็นการอัปเดตปกติ หรือ การวางแผนล่วงหน้า (Draft)
  @IsString()
  @IsOptional()
  movementStatus?: 'EFFECTIVE' | 'PENDING';

  // 🌟 เพิ่มฟิลด์สำหรับอ้างอิง ID ของผังองค์กรฉบับร่าง (Draft Version ID)
  @IsInt()
  @IsOptional()
  orgVersionId?: number;

  // 🌟 เพิ่มฟิลด์ Effective Date (ถ้ามีใน DTO เดิมอยู่แล้วข้ามไปได้ครับ)
  @IsDateString()
  @IsOptional()
  effectiveDate?: string;
}

// =========================================================
// 3. DTO สำหรับการแจ้งลาออก (Resign)
// =========================================================
export class ResignEmployeeDto {
  @IsDateString()
  effectiveDate!: string; // วันที่มีผล

  @IsString()
  type!: 'RESIGNATION' | 'TERMINATION'; // ลาออกเอง หรือ ถูกเชิญออก

  @IsString()
  @IsOptional()
  reason?: string;
}

// =========================================================
// 4. DTO สำหรับการจ้างกลับ (Re-hire)
// =========================================================
export class RehireEmployeeDto {
  @IsDateString()
  rehireDate!: string;

  @IsInt()
  newPositionId!: number;

  @IsInt()
  newDepartmentId!: number;

  @IsInt()
  @IsOptional()
  newSalary?: number; 

  @IsString()
  @IsOptional()
  note?: string;
}

// =========================================================
// 5. DTO ยกเลิกการลาออก (Cancel Resignation)
// =========================================================
export class CancelResignationDto {
  @IsString()
  @IsOptional()
  reason?: string;

  @IsEnum(EmploymentStatus)
  @IsOptional()
  restoreStatus?: EmploymentStatus; 
}