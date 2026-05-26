import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import { json, urlencoded } from 'express'; 

async function bootstrap() {
  // ✅ เปิดใช้งาน rawBody เพื่อให้ LineController ตรวจสอบ x-line-signature ได้
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });

  // =========================================================
  // ✅ 0. BigInt Serialization Polyfill
  // =========================================================
  (BigInt.prototype as any).toJSON = function () {
    return this.toString();
  };

  // 1. ✅ ตั้งค่า Prefix '/api'
  app.setGlobalPrefix('api');

  // 2. ✅ เปิดใช้งาน ValidationPipe เพื่อความปลอดภัยของข้อมูลที่รับเข้ามา
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
  }));

  // 3. ✅ ตั้งค่า Swagger UI สำหรับทดสอบ API
  const config = new DocumentBuilder()
    .setTitle('KKV-Mainservice API')
    .setDescription('ระบบหลังบ้าน KKV สำหรับ E-commerce, CMS และ AI Workflow')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  // 4. ✅ ปรับปรุง CORS เพื่อรองรับโดเมนหลักและ Staging
  app.enableCors({
    origin: '*', 
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });

  // =========================================================
  // 🌟 5. ขยายขนาด Payload Limit เพื่อรองรับรูปภาพ Base64
  // =========================================================
  app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ extended: true, limit: '50mb' }));

  // =========================================================
  // 🛡️ [NEW] 5.1 ระบบป้องกัน Zombie Connections (Graceful Shutdown)
  // =========================================================
  app.enableShutdownHooks();

  // 6. ✅ กำหนด Port และเริ่มการทำงานของเซิร์ฟเวอร์
  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`🚀 KKV-Mainservice is running on: http://localhost:${port}/api`);
  console.log(`📡 Production: https://kkvservice.com`);
  console.log(`🧪 Staging: https://stage.kkvservice.com`);
}
bootstrap();