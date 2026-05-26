import { Module, Global } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { PrismaModule } from '../../../prisma/prisma.module';
import { StorageService } from '../../sys/storage/storage.service'; // ✅ 1. Import StorageService

@Global()
@Module({
  imports: [PrismaModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, StorageService], // ✅ 2. เพิ่มเข้า Providers
  exports: [NotificationsService],
})
export class NotificationsModule {}