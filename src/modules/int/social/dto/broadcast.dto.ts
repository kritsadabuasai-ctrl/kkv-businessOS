import { IsString, IsArray, IsOptional, IsInt, IsUrl, IsEnum } from 'class-validator';

// ✅ สร้าง Enum เพื่อคุมค่าให้เป๊ะ
export enum BroadcastChannel {
  LINE = 'LINE',
  FACEBOOK = 'FACEBOOK',
  IN_APP = 'IN_APP'
}

export class BroadcastDto {
  @IsString()
  message!: string; // ข้อความหลัก

  @IsOptional() // ✅ บางทีแค่อยากประกาศข่าว ไม่จำเป็นต้องมีลิงก์เสมอไป
  @IsString()
  @IsUrl()
  link?: string; // ลิงก์ปลายทาง

  @IsOptional() // ✅ บางทีอยากโพสต์แค่ข้อความ ไม่มีรูป
  @IsString()
  @IsUrl()
  coverImageUrl?: string; // รูปปก

  @IsArray()
  @IsEnum(BroadcastChannel, { each: true }) // ✅ บังคับว่าต้องเป็นค่าใน Enum เท่านั้น
  channels!: BroadcastChannel[]; // ['LINE', 'FACEBOOK']

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  targetPageIds?: number[]; // ID ของ Facebook Page
}