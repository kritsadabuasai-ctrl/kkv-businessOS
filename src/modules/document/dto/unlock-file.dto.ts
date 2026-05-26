import { IsNotEmpty, IsString } from 'class-validator';

export class UnlockFileDto {
  @IsString()
  @IsNotEmpty()
  password!: string;
}