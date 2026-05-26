import { Module } from '@nestjs/common';
import { MenuConfigsService } from './menu-configs.service';
import { MenuConfigsController } from './menu-configs.controller';
import { PrismaModule } from '../../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [MenuConfigsController],
  providers: [MenuConfigsService],
  exports: [MenuConfigsService]
})
export class MenuConfigsModule {}