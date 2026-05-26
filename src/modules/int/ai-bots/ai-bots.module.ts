import { Module, Global, forwardRef } from '@nestjs/common'; // 🌟 1. นำเข้า forwardRef
import { AiBotsController } from './ai-bots.controller';
import { AiBotsService } from './ai-bots.service';
import { AiRuntimeService } from './ai-runtime.service';
import { AiTaggingService } from '../ai-tagging/ai-tagging.service'; 
import { PrismaModule } from '../../../prisma/prisma.module';
import { CloudConfigsModule } from '../cloud-configs/cloud-configs.module';
import { ProductsModule } from '../../com/products/products.module';
import { KnowledgeBaseModule } from '../knowledge-bases/knowledge-base.module';
import { AiQuotasModule } from "../ai-quotas/ai-quotas.module";
import { TagsModule } from '../../com/tags/tags.module';
import { FileParserModule } from '../../int/file-parser/file-parser.module'; 

@Global()
@Module({
  imports: [
    PrismaModule,        
    CloudConfigsModule,  
    forwardRef(() => ProductsModule), // 🌟 2. ใช้ forwardRef หุ้มโมดูล Products ไว้
    KnowledgeBaseModule,
    AiQuotasModule,
    TagsModule,
    FileParserModule, 
  ],
  controllers: [AiBotsController], 
  providers: [AiBotsService, AiRuntimeService, AiTaggingService],
  exports: [AiBotsService, AiRuntimeService, AiTaggingService],
})
export class AiBotsModule {}