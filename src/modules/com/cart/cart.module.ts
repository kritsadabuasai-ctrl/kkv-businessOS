import { Module } from '@nestjs/common';
import { CartService } from './cart.service';
import { CartController } from './cart.controller';
import { PrismaModule } from '../../../prisma/prisma.module';

@Module({
  imports: [PrismaModule], // นำเข้า PrismaModule เพื่อให้ Service เรียกใช้งาน Database ได้
  controllers: [CartController],
  providers: [CartService],
  exports: [CartService], // 💡 ส่งออก CartService เผื่อไว้ให้ OrderModule เรียกใช้ตอนทำระบบ Checkout ในอนาคต
})
export class CartModule {}