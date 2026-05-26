import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AskCopilotDto {
  @ApiProperty({ description: 'คำถามที่พนักงานต้องการถาม AI' })
  @IsString()
  @IsNotEmpty()
  question!: string;
}