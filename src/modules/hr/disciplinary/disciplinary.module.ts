import { Module } from '@nestjs/common';
import { DisciplinaryController } from './disciplinary.controller';
import { DisciplinaryService } from './disciplinary.service';
import { PrismaModule } from '../../../prisma/prisma.module';  // สมมติ path

@Module({
  imports: [PrismaModule],
  controllers: [DisciplinaryController],
  providers: [DisciplinaryService],
  exports: [DisciplinaryService],
})
export class DisciplinaryModule {}