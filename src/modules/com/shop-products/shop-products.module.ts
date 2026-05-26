import { Module } from '@nestjs/common';
import { ShopProductsService } from './shop-products.service';
import { ShopProductsController } from './shop-products.controller';
import { PrismaModule } from '../../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ShopProductsController],
  providers: [ShopProductsService],
  exports: [ShopProductsService], // Export เผื่อระบบ POS หรือ Order ต้องมาเช็คราคา
})
export class ShopProductsModule {}