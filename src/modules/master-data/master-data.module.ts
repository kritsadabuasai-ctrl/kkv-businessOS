import { Module } from '@nestjs/common';
import { GeographyModule } from './geography/geography.module';
import { BankModule } from './bank/bank.module';

@Module({
  imports: [
    // 📍 เอา Module ย่อยๆ มารวมกันตรงนี้ที่เดียว
    GeographyModule,
    BankModule,
    
    // 💡 ในอนาคตถ้ามี CfgPrefixModule, CfgUnitModule ก็เอามาต่อท้ายตรงนี้ได้เลยครับ
  ],
  // เผื่อในอนาคตโมดูลอื่นๆ ในระบบอยากใช้ Service จาก Master Data 
  // เราสามารถ export ออกไปให้โมดูลอื่นใช้ต่อได้เลยครับ
  exports: [
    GeographyModule,
    BankModule,
  ]
})
export class MasterDataModule {}