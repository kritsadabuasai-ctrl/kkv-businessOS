import { Module, Global } from '@nestjs/common';
import { ComTemplateService } from './com-template.service';
import { ComTemplateController } from './com-template.controller';
import { PrismaModule } from '../../../prisma/prisma.module';

@Global()
@Module({
  imports: [PrismaModule],
  controllers: [ComTemplateController],
  providers: [ComTemplateService],
  exports: [ComTemplateService],
})
export class ComTemplateModule {}