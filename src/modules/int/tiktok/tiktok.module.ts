import { Module, forwardRef } from '@nestjs/common';
import { TiktokService } from './tiktok.service';
import { TiktokController } from './tiktok.controller';
import { ChatModule } from '../../int/chat/chat.module';

@Module({
  imports: [
    forwardRef(() => ChatModule), 
  ],
  controllers: [TiktokController],
  providers: [TiktokService],
  exports: [TiktokService], 
})
export class TiktokModule {}