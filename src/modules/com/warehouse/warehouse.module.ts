import { Module } from '@nestjs/common';
import { WarehouseService } from './warehouse.service';
import { WarehouseController } from './warehouse.controller';
// อย่าลืม Import PrismaModule ให้ถูกต้องตามพาธของโปรเจกต์คุณด้วยนะครับ
import { PrismaModule } from '../../../prisma/prisma.module'; 

@Module({
  imports: [PrismaModule],
  controllers: [WarehouseController],
  providers: [WarehouseService],
  exports: [WarehouseService], // Export ไว้เผื่อให้ module อื่น (เช่น order/stock) เรียกใช้ได้
})
export class WarehouseModule {}