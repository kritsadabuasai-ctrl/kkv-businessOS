import { Module, Global } from '@nestjs/common';
import { SystemConfigsService } from './system-configs.service';
import { SystemConfigsController } from './system-configs.controller';
import { PrismaModule } from '../../../prisma/prisma.module';

@Global() // ✅ ให้ Module อื่นเข้าถึงค่า Config ได้โดยไม่ต้อง Import ซ้ำ
@Module({
  imports: [PrismaModule],
  controllers: [SystemConfigsController],
  providers: [SystemConfigsService],
  exports: [SystemConfigsService],
})
export class SystemConfigsModule {}