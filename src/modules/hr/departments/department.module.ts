import { Module } from '@nestjs/common';
import { DepartmentController } from './department.controller';
import { DepartmentService } from './department.service';
import { PrismaModule } from '../../../prisma/prisma.module'; // ✅ Import ส่วนกลาง

@Module({
  imports: [PrismaModule], // ✅ ใส่ตรงนี้
  controllers: [DepartmentController],
  providers: [DepartmentService],
  exports: [DepartmentService], // เผื่อเอาไปใช้ตอน Dropdown เลือกแผนกในหน้าอื่น
})
export class DepartmentModule {}