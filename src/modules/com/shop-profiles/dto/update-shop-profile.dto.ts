import { PartialType } from '@nestjs/mapped-types'; // หมายเหตุ: ถ้าใช้ Swagger เปลี่ยนเป็น '@nestjs/swagger'
import { CreateShopProfileDto } from './create-shop-profile.dto';

export class UpdateShopProfileDto extends PartialType(CreateShopProfileDto) {}