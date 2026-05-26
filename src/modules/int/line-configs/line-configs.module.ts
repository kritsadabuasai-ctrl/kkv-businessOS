import { Module } from '@nestjs/common';
import { LineConfigsService } from './line-configs.service';
import { LineConfigsController } from './line-configs.controller';
import { PrismaModule } from '../../../prisma/prisma.module';
import { CloudConfigsModule } from '../cloud-configs/cloud-configs.module';

@Module({
  imports: [PrismaModule, CloudConfigsModule],
  controllers: [LineConfigsController],
  providers: [LineConfigsService],
  exports: [LineConfigsService],
})
export class LineConfigsModule {}