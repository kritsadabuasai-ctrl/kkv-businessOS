import { Module } from '@nestjs/common';
import { PaymentMethodsService } from './payment-methods.service';
import { PaymentMethodsController } from './payment-methods.controller';
import { PrismaModule } from '../../../prisma/prisma.module';


@Module({
  imports: [PrismaModule],
  controllers: [PaymentMethodsController],
  providers: [PaymentMethodsService],
  exports: [PaymentMethodsService], // Export เผื่อ Module Order/Checkout ต้องใช้
})
export class PaymentMethodsModule {}