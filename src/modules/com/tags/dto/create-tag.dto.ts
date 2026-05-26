import { IsString, IsNotEmpty } from 'class-validator';

export class CreateTagDto {
  @IsString()
  @IsNotEmpty()
  name: string; // เช่น "เสื้อยืด", "สีแดง", "View:Top"
}