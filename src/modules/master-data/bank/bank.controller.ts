import { Controller, Get, Param } from '@nestjs/common';
import { BankService } from './bank.service';

// 📍 กำหนด Endpoint หลักเป็น /api/master-data/bank
@Controller('master-data/bank') 
export class BankController {
  constructor(private readonly bankService: BankService) {}

  // GET: /api/master-data/bank
  // คืนค่ารายการธนาคารทั้งหมด สำหรับเอาไปทำ Dropdown หรือ UI เลือกธนาคาร
  @Get()
  async getAllBanks() {
    return this.bankService.getActiveBanks();
  }

  // GET: /api/master-data/bank/:code
  // เผื่อหน้าบ้านอยากดึงข้อมูลธนาคารเฉพาะเจาะจง เช่น /api/master-data/bank/KBANK
  @Get(':code')
  async getBankByCode(@Param('code') code: string) {
    return this.bankService.getBankByCode(code);
  }
}