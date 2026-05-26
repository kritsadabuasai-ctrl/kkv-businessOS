import { Module, Global } from '@nestjs/common';
import { FileParserService } from './file-parser.service';

@Global() // แนะนำเป็น Global เพราะอาจใช้ทั้ง Knowledge Base และ HR (Resume)
@Module({
  providers: [FileParserService],
  exports: [FileParserService],
})
export class FileParserModule {}