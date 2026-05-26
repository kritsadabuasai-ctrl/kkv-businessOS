import { Module } from '@nestjs/common';
import { ShippingRulesService } from './shipping-rules.service';
import { ShippingRulesController } from './shipping-rules.controller';
import { PrismaModule } from '../../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ShippingRulesController],
  providers: [ShippingRulesService],
  exports: [ShippingRulesService],
})
export class ShippingRulesModule {}