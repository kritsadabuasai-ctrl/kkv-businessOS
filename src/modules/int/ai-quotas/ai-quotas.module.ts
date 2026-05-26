import { Module, Global } from '@nestjs/common';
import { AiQuotasService } from './ai-quotas.service';
import { AiQuotasController } from './ai-quotas.controller';
import { PrismaModule } from '../../../prisma/prisma.module';

@Global() // ✅ แนะนำให้เป็น Global เพราะโมดูล AI อื่นๆ (เช่น ChatBot) ต้องเรียกใช้เพื่อหักโควตา
@Module({
  imports: [PrismaModule],
  controllers: [AiQuotasController],
  providers: [AiQuotasService],
  exports: [AiQuotasService],
})
export class AiQuotasModule {}