import { Module } from '@nestjs/common';
import { InstagramConfigsService } from './instagram-configs.service';
import { InstagramConfigsController } from './instagram-configs.controller';
import { PrismaModule } from '../../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [InstagramConfigsController],
  providers: [InstagramConfigsService],
  exports: [InstagramConfigsService], 
})
export class InstagramConfigsModule {}