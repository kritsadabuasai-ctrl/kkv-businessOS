// 📂 File: src/modules/sec/modules/modules.module.ts
import { Module } from '@nestjs/common';
import { ModulesService } from './modules.service';
import { ModulesController } from './modules.controller';
import { PrismaModule } from '../../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ModulesController],
  providers: [ModulesService],
  exports: [ModulesService] // Export เพื่อให้คนอื่นใช้ Service ได้
})
export class SysModulesModule {}