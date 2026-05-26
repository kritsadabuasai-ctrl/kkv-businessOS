import { Module } from '@nestjs/common';
import { AiModelConfigService } from './ai-model-config.service';
import { AiModelConfigController } from './ai-model-config.controller';
import { PrismaModule } from '../../../prisma/prisma.module'; // ปรับ path ตามโปรเจกต์คุณ

@Module({
  imports: [PrismaModule],
  controllers: [AiModelConfigController],
  providers: [AiModelConfigService],
  exports: [AiModelConfigService],
})
export class AiModelConfigModule {}