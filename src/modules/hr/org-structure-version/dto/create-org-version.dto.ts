import { IsNotEmpty, IsInt, IsString, IsOptional, IsEnum } from 'class-validator';

export class CreateOrgVersionDto {
  @IsNotEmpty()
  @IsInt()
  calendarId!: number;

  @IsNotEmpty()
  @IsString()
  name!: string;

  @IsOptional()
  @IsInt()
  version?: number;
}