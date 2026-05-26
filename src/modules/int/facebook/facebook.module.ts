import { Module, forwardRef } from '@nestjs/common';
import { FacebookService } from './facebook.service';
import { FacebookController } from './facebook.controller';
import { ChatModule } from '../../int/chat/chat.module';

@Module({
  imports: [
    // 🌟 1. ครอบด้วย forwardRef ป้องกันงูกินหางตอน Deploy
    forwardRef(() => ChatModule), 
  ],
  controllers: [FacebookController],
  providers: [FacebookService],
  exports: [FacebookService], // 🌟 2. ส่งออกให้ ChatService เอาไปใช้ตอบลูกค้า
})
export class FacebookModule {}