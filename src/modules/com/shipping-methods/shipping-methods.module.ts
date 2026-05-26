import { Module } from '@nestjs/common';
import { ShippingMethodsService } from './shipping-methods.service';
import { ShippingMethodsController } from './shipping-methods.controller';
import { PrismaModule } from '../../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ShippingMethodsController],
  providers: [ShippingMethodsService],
  exports: [ShippingMethodsService], // Export เผื่อ Module Checkout เอาไปคำนวณค่าส่ง
})
export class ShippingMethodsModule {}