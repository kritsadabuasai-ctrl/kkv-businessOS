import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateSystemConfigDto {
  @IsString()
  @IsNotEmpty()
  configKey: string; 

  @IsString()
  @IsNotEmpty()
  configValue: string; 

  @IsString()
  @IsOptional()
  description?: string; 
}

export class UpdateSystemConfigDto {
  @IsOptional() @IsString() configValue?: string;
  @IsOptional() @IsString() description?: string;
}