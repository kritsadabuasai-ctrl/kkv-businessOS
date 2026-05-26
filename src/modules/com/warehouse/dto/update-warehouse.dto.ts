import { PartialType } from '@nestjs/mapped-types'; // 💡 ถ้าใช้ Swagger สามารถดึงมาจาก '@nestjs/swagger' แทนได้ครับ
import { CreateWarehouseDto } from './create-warehouse.dto';

export class UpdateWarehouseDto extends PartialType(CreateWarehouseDto) {}