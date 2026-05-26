import { PartialType } from '@nestjs/swagger'; // หรือใช้จาก '@nestjs/mapped-types' ตามที่โปรเจกต์ตั้งค่าไว้
import { CreateManpowerRequestDto } from './create-manpower-request.dto';

export class UpdateManpowerRequestDto extends PartialType(CreateManpowerRequestDto) {}