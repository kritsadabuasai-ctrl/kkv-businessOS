import { Module, forwardRef } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { PrismaModule } from '../../../prisma/prisma.module';
import { LineModule } from '../../int/line/line.module'; 
import { FacebookModule } from '../../int/facebook/facebook.module'; // 🌟 1. นำเข้า Facebook
import { TiktokModule } from '../../int/tiktok/tiktok.module';
import { InstagramModule } from '../../int/instagram/instagram.module';

@Module({
  imports: [
    PrismaModule, 
    forwardRef(() => LineModule),
    forwardRef(() => FacebookModule),
    forwardRef(() => TiktokModule),
    forwardRef(() => InstagramModule)
  ],
  controllers: [ChatController],
  providers: [ChatService],
  exports: [ChatService], 
})
export class ChatModule {}