import { Module, Global } from '@nestjs/common';
import { RunningNumbersService } from './running-numbers.service';
import { RunningNumbersController } from './running-numbers.controller';
import { PrismaModule } from '../../../prisma/prisma.module';

@Global() // ✅ ทำให้ Module อื่นเรียกขอเลขที่เอกสารได้ง่าย
@Module({
  imports: [PrismaModule],
  controllers: [RunningNumbersController],
  providers: [RunningNumbersService],
  exports: [RunningNumbersService],
})
export class RunningNumbersModule {}