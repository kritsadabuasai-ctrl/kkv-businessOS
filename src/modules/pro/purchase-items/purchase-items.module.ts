import { Module } from '@nestjs/common';
import { PurchaseItemsService } from './purchase-items.service';
import { PurchaseItemsController } from './purchase-items.controller';
import { PrismaModule } from '../../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [PurchaseItemsController],
  providers: [PurchaseItemsService],
  exports: [PurchaseItemsService],
})
export class PurchaseItemsModule {}