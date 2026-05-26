import { Module, forwardRef } from '@nestjs/common'; // 🌟 1. นำเข้า forwardRef
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { PrismaModule } from '../../../prisma/prisma.module';
import { StorageModule } from '../../sys/storage/storage.module';
import { AiBotsModule } from '../../int/ai-bots/ai-bots.module'; 

@Module({
  imports: [
    PrismaModule, 
    StorageModule, 
    forwardRef(() => AiBotsModule) // 🌟 2. ใช้ forwardRef หุ้มโมดูล AI ไว้
  ],
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}