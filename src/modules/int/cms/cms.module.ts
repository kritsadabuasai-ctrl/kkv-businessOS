import { Module } from '@nestjs/common';
import { CmsPagesService } from './cms-pages.service';
import { CmsPagesController } from './cms-pages.controller';
import { PrismaModule } from '../../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [CmsPagesController],
  providers: [CmsPagesService],
  exports: [CmsPagesService]
})
export class CmsModule {}