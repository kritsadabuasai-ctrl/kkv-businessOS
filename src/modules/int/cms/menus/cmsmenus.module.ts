import { Module } from '@nestjs/common';
import { CmsMenusService } from './cmsmenus.service';
import { CmsMenusController } from './cmsmenus.controller';
import { PrismaModule } from '../../../../prisma/prisma.module'; // ปรับ path ตามจริง

@Module({
  imports: [PrismaModule],
  controllers: [CmsMenusController],
  providers: [CmsMenusService],
  exports: [CmsMenusService]
})
export class CmsMenusModule {}