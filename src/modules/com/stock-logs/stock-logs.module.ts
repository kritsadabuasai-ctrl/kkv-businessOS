import { Module, Global } from '@nestjs/common';
import { StockLogsService } from './stock-logs.service';
import { StockLogsController } from './stock-logs.controller';
import { PrismaModule } from '../../../prisma/prisma.module'; // ตรวจสอบ path

@Global() 
@Module({
  imports: [PrismaModule],
  controllers: [StockLogsController],
  providers: [StockLogsService],
  exports: [StockLogsService], 
})
export class StockLogsModule {}