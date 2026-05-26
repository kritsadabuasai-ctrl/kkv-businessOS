import { Module } from '@nestjs/common';
import { RoundingRulesService } from './rounding-rules.service';
import { RoundingRulesController } from './rounding-rules.controller';
import { PrismaModule } from '../../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [RoundingRulesController],
  providers: [RoundingRulesService],
  exports: [RoundingRulesService], // ✅ Export ให้โมดูลอื่นเรียกใช้ Logic ปัดเศษได้
})
export class RoundingRulesModule {}