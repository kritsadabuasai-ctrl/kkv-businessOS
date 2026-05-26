import { Module } from '@nestjs/common';
import { CompanyConfigsService } from './company-configs.service';
import { CompanyConfigsController } from './company-configs.controller';
import { PrismaModule } from '../../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [CompanyConfigsController],
  providers: [CompanyConfigsService],
  exports: [CompanyConfigsService],
})
export class CompanyConfigsModule {}