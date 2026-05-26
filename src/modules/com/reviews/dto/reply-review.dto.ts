import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ReplyReviewDto {
  @IsString()
  @IsNotEmpty({ message: 'ข้อความตอบกลับห้ามว่าง' })
  @MaxLength(1000, { message: 'ข้อความตอบกลับยาวเกินไป' })
  message: string;
}