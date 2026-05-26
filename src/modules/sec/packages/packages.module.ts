import { Module } from '@nestjs/common';
import { PackagesService } from './packages.service';
import { PackagesController } from './packages.controller';
import { PrismaModule } from '../../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [PackagesController],
  providers: [PackagesService],
  exports: [PackagesService], // Export เผื่อ Module อื่น (เช่น Registration) ต้องใช้
})
export class PackagesModule {}