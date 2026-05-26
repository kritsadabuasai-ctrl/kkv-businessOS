import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateMasterDataDto, UpdateMasterDataDto } from './master.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class MasterDataService {
  constructor(private prisma: PrismaService) {}

 
async findAll(companyId?: number) {
    const where: Prisma.CfgMasterDataWhereInput = companyId
      ? { OR: [{ companyId: null }, { companyId }] }
      : { companyId: null };

    return this.prisma.cfgMasterData.findMany({ where });
  }



// 🌟 1. ปรับปรุงการดึงข้อมูล (ถ้าร้านค้ามีการ Override แล้ว ให้ดึงเฉพาะของร้านค้านั้นๆ เท่านั้น)
  async findByGroup(groupCode: string, companyId?: number) {
    // 1. ถ้าไม่มี companyId ให้ดึงของส่วนกลาง (Global) ไปเลย
    if (!companyId) {
      return this.prisma.cfgMasterData.findMany({
        where: { 
          masterGroup: { groupCode: groupCode }, 
          companyId: null 
        },
        orderBy: { sortOrder: 'asc' }
      });
    }

    // 2. ถ้ามี companyId (เป็นบริษัทสาขา) ให้หาของสาขาก่อน
    const locals = await this.prisma.cfgMasterData.findMany({
      where: { 
        masterGroup: { groupCode: groupCode }, 
        companyId: companyId 
      },
      orderBy: { sortOrder: 'asc' }
    });

    // 🌟 3. ถ้าบริษัทสาขามีการ Override ข้อมูลกลุ่มนี้ไว้แล้ว ให้รีเทิร์นของสาขาไปเลย ไม่ต้อง Merge!
    if (locals.length > 0) {
      return locals;
    }

    // 🌟 4. แต่ถ้าสาขายังไม่เคยแก้ไขข้อมูลกลุ่มนี้เลย (locals ว่างเปล่า) ค่อยไปดึงของ Global มาใช้แทน
    return this.prisma.cfgMasterData.findMany({
      where: { 
        masterGroup: { groupCode: groupCode }, 
        companyId: null 
      },
      orderBy: { sortOrder: 'asc' }
    });
  }

/**
   * 🌟 ฟังก์ชันสำหรับให้บริษัท (Company) อัปเดตข้อมูล Master Data ของตัวเอง
   * โดยใช้หลักการ Copy-on-Write: 
   * หากเป็นการแก้ไขครั้งแรก ระบบจะ Clone ข้อมูลทั้งกลุ่มจาก Global มาเป็นของบริษัทนั้นๆ ก่อน
   */
async overrideMetadata(companyId: number, data: any, userId: number) {
    const { groupCode, code, name, labels, isActive, sortOrder, colorCode, parentId } = data;

    // 🌟 1. เช็คสถานะของ "บริษัท" ที่ส่งเข้ามาใน Request ว่าเป็น HQ หรือไม่
    // โดยดูว่า licenseHolderId เป็น null หรือเปล่า
    const currentCompany = await this.prisma.orgCompany.findUnique({
      where: { id: companyId },
      select: { licenseHolderId: true }
    });

    if (!currentCompany) throw new NotFoundException(`ไม่พบบริษัท ID: ${companyId}`);

    const isCurrentCompanyHQ = currentCompany.licenseHolderId === null;

    // 2. หา ID ของกลุ่มแม่ (Master Group)
    const group = await this.prisma.cfgMasterGroup.findUnique({ 
      where: { groupCode } 
    });
    if (!group) throw new NotFoundException(`ไม่พบกลุ่มข้อมูลรหัส: ${groupCode}`);
    
    const masterGroupId = group.id;

    // ==========================================
    // 👑 ลอจิกสำหรับ HQ: อัปเดตทับข้อมูลของระบบส่วนกลาง (Global)
    // ==========================================
    if (isCurrentCompanyHQ) {
      const globalRef = await this.prisma.cfgMasterData.findFirst({
         where: { masterGroupId, code, companyId: null }
      });
      
      if (globalRef) {
        return this.prisma.cfgMasterData.update({
          where: { id: globalRef.id },
          data: {
            name: name ?? globalRef.name,
            labels: labels ?? globalRef.labels,
            isActive: isActive !== undefined ? isActive : globalRef.isActive,
            sortOrder: sortOrder ?? globalRef.sortOrder,
            colorCode: colorCode !== undefined ? colorCode : globalRef.colorCode,
            parentId: parentId !== undefined ? parentId : globalRef.parentId,
          }
        });
      } else {
        // กรณี HQ กดเพิ่มรายการใหม่ที่ไม่เคยมีในระบบ
        return this.prisma.cfgMasterData.create({
          data: {
            masterGroupId,
            companyId: null, // เซฟเป็นค่ากลางให้เลย
            code,
            name: name ?? code,
            labels: labels ?? {},
            isActive: isActive !== undefined ? isActive : true,
            sortOrder: sortOrder ?? 99,
            colorCode: colorCode,
            parentId: parentId,
          }
        });
      }
    }

    // ==========================================
    // 🏢 ลอจิกสำหรับสาขาทั่วไป (บริษัทลูก): Copy-on-Write ทั้งกลุ่ม
    // ==========================================
    
    // 3. ตรวจสอบว่าสาขานี้ "เคย" ก๊อปปี้กลุ่มนี้มาเป็นของตัวเองหรือยัง?
    const existingLocals = await this.prisma.cfgMasterData.findMany({
      where: { masterGroupId, companyId }
    });

    // 4. ถ้ายังไม่เคยมีเลย (First-time override) -> ให้ Clone ทั้งกลุ่มมาทันที!
    if (existingLocals.length === 0) {
      const globalItems = await this.prisma.cfgMasterData.findMany({
        where: { masterGroupId, companyId: null }
      });

      if (globalItems.length > 0) {
        const itemsToClone = globalItems.map(item => ({
          masterGroupId: item.masterGroupId,
          companyId: companyId, // ประทับตราสาขา
          code: item.code,
          name: item.name,
          labels: item.labels ?? {}, 
          isActive: item.isActive,
          sortOrder: item.sortOrder,
          colorCode: item.colorCode,
          parentId: item.parentId
        }));

        await this.prisma.cfgMasterData.createMany({
          data: itemsToClone
        });
      }
    }

    // 5. หลังจาก Clone เสร็จ ให้หา Record ของตัวที่กดอัปเดต/เพิ่ม
    const targetLocalItem = await this.prisma.cfgMasterData.findFirst({
      where: { masterGroupId, code, companyId }
    });

    if (targetLocalItem) {
      // กรณีแก้ของเดิม
      return this.prisma.cfgMasterData.update({
        where: { id: targetLocalItem.id },
        data: {
          name: name !== undefined ? name : undefined,
          labels: labels !== undefined ? labels : undefined,
          isActive: isActive !== undefined ? isActive : undefined,
          sortOrder: sortOrder !== undefined ? sortOrder : undefined,
          colorCode: colorCode !== undefined ? colorCode : undefined,
          parentId: parentId !== undefined ? parentId : undefined,
        }
      });
    } else {
      // กรณีเพิ่มของใหม่ที่ไม่มีใน Global
      return this.prisma.cfgMasterData.create({
        data: {
          masterGroupId,
          companyId, // บังคับเป็นของบริษัทสาขา
          code,
          name: name ?? code,
          labels: labels ?? {},
          isActive: isActive !== undefined ? isActive : true,
          sortOrder: sortOrder ?? 99,
          colorCode: colorCode,
          parentId: parentId,
        }
      });
    }
  }

  
  async findOne(id: number) {
    const item = await this.prisma.cfgMasterData.findUnique({ where: { id } });
    if (!item) throw new NotFoundException(`Metadata ID ${id} not found`);
    return item;
  }

  async create(data: Prisma.CfgMasterDataUncheckedCreateInput) {
    return this.prisma.cfgMasterData.create({ data });
  }

  async update(id: number, data: Prisma.CfgMasterDataUncheckedUpdateInput) {
    await this.findOne(id);
    return this.prisma.cfgMasterData.update({
      where: { id },
      data
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.cfgMasterData.delete({ where: { id } });
  }

  


  // ===========================================================================
  // 🚀 ส่วนที่เพิ่ม: Helper Functions (Mapping ตาม Excel ของคุณ)
  // เพื่อให้ Frontend (Loveable.ai) เรียกใช้ง่ายๆ ไม่ต้องจำ Code
  // ===========================================================================

  async getGenders(companyId?: number) {
    return this.findByGroup('C_SEX', companyId); // ชาย, หญิง
  }

  async getTitles(companyId?: number) {
    return this.findByGroup('C_TIT', companyId); // นาย, นาง, นางสาว, ยศ
  }

  async getEducationLevels(companyId?: number) {
    return this.findByGroup('C_EDU', companyId); // ปริญญาตรี, โท, เอก
  }

  async getEmployeeStatuses(companyId?: number) {
    return this.findByGroup('Emp_Status', companyId); // ทดลองงาน, บรรจุ, ลาออก
  }

  async getWorkflowStatuses(companyId?: number) {
    return this.findByGroup('WF_STATUS', companyId); // อนุมัติ, ไม่อนุมัติ
  }

  async getOrgTypes(companyId?: number) {
    return this.findByGroup('ORG_COM', companyId); // บุคคลธรรมดา, นิติบุคคล
  }

  async getDocumentTypes(companyId?: number) {
    // สมมติว่าใน Excel คุณอาจจะมี Group นี้สำหรับ Running Numbers
    // ถ้าไม่มีใน Excel ตอนนี้ ให้ไปเพิ่ม Group Code 'DOCUMENT_TYPE' ใน DB ทีหลังได้ครับ
    return this.findByGroup('DOCUMENT_TYPE', companyId);
  }

  // ===========================================================================
  // ⚙️ ส่วนจัดการข้อมูล (CRUD เดิม)
  // ===========================================================================

 

}