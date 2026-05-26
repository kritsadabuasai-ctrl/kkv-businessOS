import { Module } from '@nestjs/common';
import { ReturnItemsService } from './return-items.service';
import { ReturnItemsController } from './return-items.controller';
import { PrismaModule } from '../../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ReturnItemsController],
  providers: [ReturnItemsService],
  exports: [ReturnItemsService], // Export เผื่อ ReturnRequest Module หลักต้องใช้
})
export class ReturnItemsModule {}