import { Module } from '@nestjs/common';
import { BankController } from './bank.controller';
import { BankService } from './bank.service';
// ⚠️ แก้ไข Path ของ PrismaModule ให้ตรงกับที่เก็บจริงเหมือนไฟล์ geography
import { PrismaModule } from '../../../prisma/prisma.module'; 

@Module({
  imports: [PrismaModule],
  controllers: [BankController],
  providers: [BankService],
  exports: [BankService], // เผื่อโมดูลอื่น (เช่น การเงิน/Payment) อยากดึง Service นี้ไปใช้
})
export class BankModule {}