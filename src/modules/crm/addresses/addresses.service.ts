import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service'; // ✅ ใช้ Service กลาง
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';

@Injectable()
export class AddressesService {
  constructor(private prisma: PrismaService) {} // ✅ Inject PrismaService

  // 1. เพิ่มที่อยู่ใหม่
  async create(companyId: number, dto: CreateAddressDto) {
    // 🔒 Security Check: สมาชิกคนนี้อยู่บริษัทเราไหม?
    const member = await this.prisma.crmMember.findUnique({
      where: { id: dto.memberId },
    });

    if (!member) throw new NotFoundException('Member not found');
    if (member.companyId !== companyId) {
      throw new ForbiddenException('Cannot add address for member in another company');
    }

    // Logic: ถ้าอันใหม่ถูกตั้งเป็น Default ให้ไปเคลียร์ Default เก่าของคนนี้ก่อน
    if (dto.isDefault) {
      await this.clearDefaultAddress(dto.memberId);
    }

    return this.prisma.crmAddress.create({
      data: { ...dto, companyId }
    });
  }

  // 2. ดูที่อยู่ทั้งหมดของสมาชิกคนนี้
  async findAllByMember(companyId: number, memberId: number) {
    // 🔒 Security Check
    const member = await this.prisma.crmMember.findUnique({ where: { id: memberId } });
    if (!member || member.companyId !== companyId) {
       // ไม่บอกว่าไม่มี (เพื่อความปลอดภัย) หรือจะ throw Error ก็ได้
       return []; 
    }

    return this.prisma.crmAddress.findMany({
      where: { memberId },
      orderBy: { isDefault: 'desc' }, // เอาตัว Default ขึ้นก่อนเสมอ
    });
  }

  // 3. ดูทีละอัน
  async findOne(companyId: number, id: number) {
    const address = await this.prisma.crmAddress.findUnique({
      where: { id },
      include: { member: true } // Join เพื่อเช็ค companyId
    });

    if (!address) throw new NotFoundException(`Address ID ${id} not found`);
    
    // 🔒 Security Check
    if (address.member.companyId !== companyId) {
        throw new ForbiddenException('Access denied to this address');
    }

    return address;
  }

  // 4. แก้ไข
  async update(companyId: number, id: number, dto: UpdateAddressDto) {
    const existing = await this.findOne(companyId, id); // ✅ เช็คสิทธิ์ในตัวแล้ว

    // ถ้ามีการแก้ให้เป็น Default ให้ไปเคลียร์ของเก่าก่อน
    if (dto.isDefault) {
      await this.clearDefaultAddress(existing.memberId);
    }

    return this.prisma.crmAddress.update({
      where: { id },
      data: { ...dto, companyId },
    });
  }

  // 5. ลบ
  async remove(companyId: number, id: number) {
    await this.findOne(companyId, id); // ✅ เช็คสิทธิ์ในตัวแล้ว
    return this.prisma.crmAddress.delete({ where: { id } });
  }

  // --- Helper: เคลียร์ค่า Default ---
  private async clearDefaultAddress(memberId: number) {
    await this.prisma.crmAddress.updateMany({
      where: { memberId, isDefault: true },
      data: { isDefault: false },
    });
  }

  // 🌟 ฟังก์ชันสำหรับตั้งค่าที่อยู่เริ่มต้น (Default Address)
  async setAsDefault(companyId: number, id: number, memberId: number) {
    return this.prisma.$transaction(async (tx) => {
      // 1. เช็คก่อนว่าที่อยู่นี้มีอยู่จริง และเป็นของลูกค้า/บริษัทนี้จริงๆ
      const address = await tx.crmAddress.findFirst({
        where: { id, memberId, member: { companyId } }
      });
      
      if (!address) {
        throw new NotFoundException('ไม่พบข้อมูลที่อยู่ หรือที่อยู่นี้ไม่ใช่ของลูกค้าท่านนี้');
      }

      // 2. ล้างค่า isDefault ของทุกที่อยู่ของลูกค้าคนนี้ให้เป็น false ทั้งหมด
      await tx.crmAddress.updateMany({
        where: { memberId },
        data: { isDefault: false },
      });

      // 3. ตั้งค่าให้ที่อยู่ที่ถูกเลือก กลายเป็น true แค่อันเดียว
      return tx.crmAddress.update({
        where: { id },
        data: { isDefault: true },
      });
    });
  }
}