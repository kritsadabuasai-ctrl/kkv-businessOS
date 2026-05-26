import { IsInt, IsNotEmpty, IsOptional, IsString, NotEquals,IsNumber } from 'class-validator';

export class CreatePointAdjustmentDto {
  @IsInt()
  @IsNotEmpty()
  memberId!: number; // ID ของสมาชิก [cite: 102, 106]

  @IsInt()
  @IsNotEmpty()
  @NotEquals(0, { message: 'จำนวนแต้มต้องไม่เป็น 0' })
  amount!: number; // ค่าบวก (+) เพื่อให้แต้ม, ค่าลบ (-) เพื่อหักแต้ม [cite: 187]

  @IsString()
  @IsNotEmpty()
  note!: string; // บังคับใส่หมายเหตุเพื่อบันทึกใน Log [cite: 188]

  @IsNumber() 
  @IsOptional() 
  shopId?: number;
}