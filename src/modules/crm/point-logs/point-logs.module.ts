import { Module, Global } from '@nestjs/common';
import { PointLogsService } from './point-logs.service';
import { PointLogsController } from './point-logs.controller';
import { PrismaService } from '../../../prisma/prisma.service'; // [cite: 11]

@Global()
@Module({
  controllers: [PointLogsController],
  providers: [PointLogsService, PrismaService],
  exports: [PointLogsService],
})
export class PointLogsModule {}