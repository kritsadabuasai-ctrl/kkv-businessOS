import { IsString, IsNotEmpty, IsEmail, IsOptional } from 'class-validator';

export class LandingRegistrationDto {
  @IsString() @IsNotEmpty() firstName!: string;
  @IsString() @IsNotEmpty() lastName!: string;
  @IsEmail() @IsNotEmpty() email!: string;
  @IsString() @IsNotEmpty() phone!: string;
  @IsString() @IsNotEmpty() companyName!: string;
  @IsString() @IsOptional() jobTitle?: string;
  @IsString() @IsOptional() industry?: string;
  @IsString() @IsOptional() knownFrom?: string; // รู้จักเราผ่านช่องทางไหน
  @IsString() @IsOptional() message?: string;   // ข้อความเพิ่มเติม/ปัญหาที่พบ
}