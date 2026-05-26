import { Module, forwardRef } from '@nestjs/common';
import { InstagramService } from './instagram.service';
import { InstagramController } from './instagram.controller';
import { ChatModule } from '../../int/chat/chat.module';

@Module({
  imports: [
    forwardRef(() => ChatModule), 
  ],
  controllers: [InstagramController],
  providers: [InstagramService],
  exports: [InstagramService], 
})
export class InstagramModule {}