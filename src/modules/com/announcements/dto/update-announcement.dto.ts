import { PartialType } from '@nestjs/mapped-types'; // เปลี่ยนเป็น @nestjs/swagger ได้ถ้าใช้งานร่วมกันอยู่
import { CreateAnnouncementDto } from './create-announcement.dto';

export class UpdateAnnouncementDto extends PartialType(CreateAnnouncementDto) {}