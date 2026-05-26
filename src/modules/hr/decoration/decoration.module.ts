import { Module } from '@nestjs/common';
import { DecorationController } from './decoration.controller';
import { DecorationService } from './decoration.service';
import { PrismaModule } from '../../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [DecorationController],
  providers: [DecorationService],
})
export class DecorationModule {}