import { PartialType } from '@nestjs/mapped-types'; // 💡 หมายเหตุ: หากใช้ Swagger ร่วมด้วย ให้เปลี่ยนเป็นดึงจาก '@nestjs/swagger'
import { CreateDiscountDto } from './create-discount.dto';

export class UpdateDiscountDto extends PartialType(CreateDiscountDto) {}