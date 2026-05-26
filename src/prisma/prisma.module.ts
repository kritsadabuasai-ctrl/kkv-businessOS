import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global() // ✅ ใส่ Global เพื่อให้เรียกใช้ได้ทุกที่โดยไม่ต้อง Import บ่อยๆ
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}