import { Module } from '@nestjs/common';
import { MeetingRoomController } from './meeting-room.controller';
import { MeetingRoomService } from './meeting-room.service';
import { PrismaModule } from '../../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [MeetingRoomController],
  providers: [MeetingRoomService],
})
export class MeetingRoomModule {}