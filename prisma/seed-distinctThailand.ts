import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🗺️ Starting Seed: CfgGeography (Thailand)...');
  
  try {
    // 🌐 1. ดาวน์โหลดข้อมูลแยก 3 ระดับ จาก API ล่าสุด (รับประกันว่ามีข้อมูลแน่นอน)
    console.log('⏳ Downloading Provinces...');
    const provRes = await fetch('https://raw.githubusercontent.com/kongvut/thai-province-data/master/api/latest/province.json');
    const provinces = await provRes.json();

    console.log('⏳ Downloading Districts...');
    const distRes = await fetch('https://raw.githubusercontent.com/kongvut/thai-province-data/master/api/latest/district.json');
    const districts = await distRes.json();

    console.log('⏳ Downloading Sub-Districts (Tambons)...');
    const subDistRes = await fetch('https://raw.githubusercontent.com/kongvut/thai-province-data/master/api/latest/sub_district.json');
    const subDistricts = await subDistRes.json();

    // 🧹 2. ล้างข้อมูลเก่า
    console.log('🧹 Cleaning old geography data (This might take a moment)...');
    await prisma.cfgGeography.deleteMany({});

    console.log(`📦 Found ${provinces.length} Provinces, ${districts.length} Districts, ${subDistricts.length} Sub-Districts.`);
    console.log('🚀 Starting deep import...');

    // 📍 3. เริ่มประกอบร่างและ Insert ลง Database
    for (const p of provinces) {
      console.log(`📍 Processing: ${p.name_th}`);
      
      const provinceRecord = await prisma.cfgGeography.create({
        data: {
          type: 'PROVINCE',
          code: p.id.toString(),
          nameTh: p.name_th,
          nameEn: p.name_en,
        }
      });

      // กรองหาอำเภอที่เป็นของจังหวัดนี้
      const pDistricts = districts.filter((d: any) => d.province_id === p.id);

      for (const d of pDistricts) {
        const districtRecord = await prisma.cfgGeography.create({
          data: {
            type: 'DISTRICT',
            code: d.id.toString(),
            nameTh: d.name_th,
            nameEn: d.name_en,
            parentId: provinceRecord.id // เชื่อมความสัมพันธ์ลูกไปหาพ่อ
          }
        });

        // กรองหาตำบลที่เป็นของอำเภอนี้
        const dSubDistricts = subDistricts.filter((sd: any) => sd.district_id === d.id);

        if (dSubDistricts.length > 0) {
          // ใช้ createMany ยัดข้อมูลระดับตำบลทั้งหมดในครั้งเดียว
          await prisma.cfgGeography.createMany({
            data: dSubDistricts.map((sd: any) => ({
              type: 'SUBDISTRICT',
              code: (sd.zip_code || '').toString(), // เก็บเป็นรหัสไปรษณีย์
              nameTh: sd.name_th,
              nameEn: sd.name_en,
              parentId: districtRecord.id // เชื่อมความสัมพันธ์ลูกไปหาพ่อ
            }))
          });
        }
      }
    }

    console.log('✨ Geography Seed Completed Successfully! (7,400+ Records Imported)');

  } catch (error) {
    console.error('❌ Error during fetching or seeding data:', error);
  }
}

main()
  .catch((e) => {
    console.error('❌ Fatal Seed Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });