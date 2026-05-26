import { Module } from '@nestjs/common';
import { WelfareController } from './welfare.controller';
import { WelfareService } from './welfare.service';
import { PrismaModule } from '../../../prisma/prisma.module'; 

@Module({
  imports: [PrismaModule],
  controllers: [WelfareController],
  providers: [WelfareService],
})
export class WelfareModule {}