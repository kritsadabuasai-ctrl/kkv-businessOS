import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { OrderItemsService } from './order-items.service';
import { OrderItemsController } from './order-items.controller';
import { PrismaModule } from '../../../prisma/prisma.module';
import { ProductsModule } from '../products/products.module';
import { RunningNumbersModule } from '../../cfg/running-numbers/running-numbers.module'; 

@Module({
  imports: [
    PrismaModule,         // ✅ 1. ต้องมี PrismaModule
    ProductsModule,       // ✅ 2. เพื่อให้ Service เรียก Product ได้
    RunningNumbersModule, // ✅ 3. ใช้สำหรับรันเลข Order No
  ],
  controllers: [
    OrdersController, 
    OrderItemsController
  ],
  providers: [
    OrdersService, 
    OrderItemsService, 
    // ❌ ไม่ต้องใส่ PrismaService ตรงนี้แล้ว
  ],
  exports: [
    OrdersService, 
    OrderItemsService
  ],
})
export class OrdersModule {}