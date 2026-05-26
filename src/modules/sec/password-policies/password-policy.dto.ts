import { IsInt, IsBoolean, IsOptional, IsString, Min, Max } from 'class-validator';

export class UpdatePasswordPolicyDto {
  @IsInt()
  @Min(6)
  @Max(32)
  minLength!: number;

  @IsBoolean()
  requireUpper!: boolean;

  @IsBoolean()
  requireLower!: boolean;

  @IsBoolean()
  requireNumber!: boolean;

  @IsBoolean()
  requireSpecial!: boolean;

  @IsString()
  specialChars!: string;

  @IsInt()
  @Min(0)
  passwordAgeDays!: number;

  @IsBoolean()
  historyCount!: boolean;

  @IsInt()
  @Min(1)
  maxLoginAttempts!: number;

  @IsInt()
  @Min(1)
  lockoutDuration!: number;
}