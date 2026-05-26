import { Module } from '@nestjs/common';
import { AddressesService } from './addresses.service';
import { AddressesController } from './addresses.controller';
import { PrismaModule } from '../../../prisma/prisma.module'; // ✅ Import Module

@Module({
  imports: [PrismaModule], // ✅ ใส่ตรงนี้
  controllers: [AddressesController],
  providers: [AddressesService],
  exports: [AddressesService], // Export เผื่อ Order Module ต้องใช้
})
export class AddressesModule {}