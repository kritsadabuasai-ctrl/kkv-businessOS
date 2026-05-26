import { Module, forwardRef } from '@nestjs/common';
import { LineService } from './line.service';
import { LineController } from './line.controller';
import { ChatModule } from '../../int/chat/chat.module';

@Module({
  imports: [
    // 🌟 ครอบ ChatModule ด้วย forwardRef
    forwardRef(() => ChatModule), 
    // ... (Module อื่นๆ ที่มีอยู่แล้ว)
  ],
  controllers: [LineController],
  providers: [LineService],
  exports: [LineService], // 🌟 อย่าลืม export LineService ให้ ChatModule ใช้ด้วยนะครับ
})
export class LineModule {}