import * as crypto from 'crypto';

// 🌟 ตัวนี้ควรดึงจาก .env (ต้องมีความยาว 32 ตัวอักษรพอดีเป๊ะ สำหรับ aes-256-cbc)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'kkv-business-os-secret-key-32bit'; 
const IV_LENGTH = 16;

// ฟังก์ชันเข้ารหัส (ก่อนลง DB)
export function encryptData(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  // เก็บ IV ไว้คู่กับข้อความที่เข้ารหัสแล้ว (คั่นด้วยเครื่องหมาย :)
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

// ฟังก์ชันถอดรหัส (ตอนจะเอาไปต่อ SMTP)
export function decryptData(text: string): string | null {
  try {
    const textParts = text.split(':');
    const ivHex = textParts.shift();
    
    // 🛡️ แก้ไข Error: ดักจับว่าถ้าไม่มีค่า ivHex ให้โยน Error ออกไป
    if (!ivHex) {
        throw new Error('รูปแบบข้อความที่ถูกเข้ารหัสไม่ถูกต้อง (Missing IV)');
    }

    const iv = Buffer.from(ivHex, 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    
    return decrypted.toString();
  } catch (error) {
    console.error('Decryption failed:', error);
    return null; // ป้องกันระบบแครชถ้าถอดรหัสไม่ได้
  }
}