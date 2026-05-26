import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔍 กำลังตรวจสอบตารางรูปภาพ (ComProductImage)...')
  
  // เช็คตาราง com_product_images
  const allColumns = await prisma.$queryRaw`
    SELECT column_name, data_type, udt_name
    FROM information_schema.columns 
    WHERE table_name = 'com_product_images';
  `

  console.log('------------------------------------------------')
  console.log('📋 รายชื่อ Column ในตาราง com_product_images:')
  
  const columns = allColumns as any[];
  
  // หาตัวที่มีคำว่า Vector
  const vectorCol = columns.find(c => c.udt_name === 'vector');
  
  if (vectorCol) {
      console.log('✅ เจอแล้ว! ชื่อจริงของมันคือ:', vectorCol.column_name);
      console.log('   ประเภทข้อมูล:', vectorCol.udt_name);
  } else {
      console.log('❌ ไม่พบ Vector (ลองดูรายชื่อทั้งหมดด้านล่าง)');
      console.table(columns.map(c => ({ name: c.column_name, type: c.udt_name })));
  }
  console.log('------------------------------------------------')
}

main()
  .catch((e) => console.error(e))
  .finally(async () => await prisma.$disconnect())