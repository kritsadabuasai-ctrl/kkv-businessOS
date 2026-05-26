import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { ProductStatus, ImageSource, MediaType, ProductType ,Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductImageDto } from './dto/product-image.dto';
import { CreateProductPriceSetDto } from './dto/product-tier-price.dto';

import { StorageService } from '../../sys/storage/storage.service';
import { AiRuntimeService } from '../../int/ai-bots/ai-runtime.service';
import { GoogleGenerativeAI } from '@google/generative-ai';


@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  // ✅ 1. ประกาศตัวแปรระดับ Class ไว้ตรงนี้ (ไม่ต้องใส่ในวงเล็บ constructor)
  private readonly genAI: GoogleGenerativeAI;

  constructor(
    private prisma: PrismaService,
    private storageService: StorageService,
    private aiRuntime: AiRuntimeService
  ) {
    // ✅ 2. สร้าง Instance ของ GoogleGenerativeAI ภายในปีกกาของ constructor
    // ตรวจสอบให้แน่ใจว่าในไฟล์ .env มี GEMINI_API_KEY=xxxxx แล้ว
    const apiKey = process.env.GEMINI_API_KEY || '';
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/ /g, '-') 
      .replace(/[^\w\u0E00-\u0E7F-]+/g, '') 
      .replace(/--+/g, '-'); 
  }

  private async ensureUniqueSlug(slug: string, excludeProductId?: number): Promise<string> {
    let uniqueSlug = slug;
    let counter = 1;
    while (true) {
      const existing = await this.prisma.comProduct.findUnique({
        where: { slug: uniqueSlug },
        select: { id: true }
      });
      if (!existing || (excludeProductId && existing.id === excludeProductId)) break;
      uniqueSlug = `${slug}-${counter}`;
      counter++;
    }
    return uniqueSlug;
  }

// ========================================================
  // 🖼️ Helper: เตรียมข้อมูลรูปภาพและ Tags สำหรับตาราง ComProductImage
  // ========================================================
 private prepareImageData(companyId: number, dto: any) {
    const source = (dto.source as ImageSource) || ImageSource.LOCAL;
    const mediaType = (dto.mediaType as MediaType) || MediaType.IMAGE;
    
    let finalUrl = dto.url;
    if (source === ImageSource.GOOGLE_DRIVE && dto.fileId) {
      finalUrl = `/api/google-drive/file/${dto.fileId}`; 
    } else if (source === ImageSource.LOCAL && finalUrl && !finalUrl.startsWith('http') && !finalUrl.startsWith('/')) {
      finalUrl = `/${finalUrl}`;
    }

    // 🌟 ปรับปรุงการจัดการ Tags ให้รองรับ Multi-company
    const tagConnects = dto.tags && Array.isArray(dto.tags) && dto.tags.length > 0 ? {
      connectOrCreate: dto.tags.map((tag: any) => {
        const tagName = typeof tag === 'string' ? tag.trim() : String(tag.name || '').trim();
        return {
          // 🚩 ใช้คีย์คู่ที่ Prisma สร้างให้ (companyId_name)
          where: { 
            companyId_name: {
              companyId: companyId,
              name: tagName
            }
          },
          // 🚩 ระบุ companyId ตอนสร้าง Tag ใหม่
          create: { 
            companyId: companyId,
            name: tagName 
          }
        };
      }).filter((t: any) => t.where.companyId_name.name.length > 0)
    } : undefined;

    return {
      companyId, // 🏢 ระบุเจ้าของรูปภาพ (สำคัญมาก!)
      source, 
      mediaType, 
      url: finalUrl || '', 
      fileId: dto.fileId,
      fileName: dto.fileName, 
      displayName: dto.displayName || dto.fileName,
      colorCode: dto.colorCode, 
      sortOrder: dto.sortOrder,
      isMain: dto.isMain || false,
      imageVector: dto.imageVector ? (dto.imageVector as any) : undefined,
      fileSize: dto.fileSize ? dto.fileSize : undefined, 
      tags: tagConnects 
    };
  }

 async generateProductDescription(productName: string, companyId: number): Promise<string> {
    try {
      this.logger.log(`Generating description for: ${productName} (Company: ${companyId})`);

      // 1. ดึง Config ของ Bot จาก Database แบบ Dynamic (ไม่ต้อง Hardcode แล้ว)
      // ⚠️ หมายเหตุ: ปรับชื่อฟังก์ชัน getBotByCode ให้ตรงกับฟังก์ชันจริงใน AiRuntimeService ของคุณ
      const botConfig = await this.aiRuntime.getBotByCode('PRODUCT_DESC_BOT'); 
      
      if (!botConfig || !botConfig.isActive) {
        throw new Error('AI Bot สำหรับสร้างคำบรรยายสินค้ายังไม่เปิดใช้งาน');
      }

      // 2. เรียกใช้ Model โดยดึงชื่อ Model และ Prompt จาก Database
      const model = this.genAI.getGenerativeModel({ 
        model: botConfig.modelName || 'gemini-2.5-flash',
        systemInstruction: botConfig.systemPrompt 
      });

      // 3. ประกอบ Prompt
      const prompt = `ชื่อสินค้า: ${productName}`;
      
      // 4. สั่งให้ AI ประมวลผล (ดึงค่าอุณหภูมิจาก Database)
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { 
            temperature: botConfig.temperature || 0.7, 
        }
      });

      // 5. ดึงข้อความที่ AI สร้างขึ้น
      const generatedText = result.response.text();

      // 6. การจัดการและหัก Token (Usage Metadata)
      const usageMetadata = result.response.usageMetadata;
      if (usageMetadata) {
        // ใช้ totalTokenCount (Prompt Tokens + Candidate Tokens)
        const totalTokens = usageMetadata.totalTokenCount;
        
        // ⚠️ หมายเหตุ: ปรับชื่อฟังก์ชัน deductTokens ให้ตรงกับฟังก์ชันจริงใน AiRuntimeService ของคุณ
        // ส่ง companyId, จำนวน Token และ ชื่อ Bot ไปบันทึกประวัติการใช้งาน
        await this.aiRuntime.deductTokens(companyId, totalTokens, 'PRODUCT_DESC_BOT');
        
        this.logger.log(`AI Text Gen Token usage: ${totalTokens} tokens deducted for company ${companyId}`);
      }

      return generatedText;

    } catch (error: any) {
      this.logger.error(`Error generating description for "${productName}":`, error.stack);
      throw new Error(error.message || 'ไม่สามารถสร้างคำบรรยายสินค้าได้ในขณะนี้');
    }
  }

// ========================================================
  // 📦 1. สร้างสินค้าใหม่ (ฉบับสมบูรณ์: คืนโควตา + ผูกไฟล์ + กรองรูปซ้ำ + รองรับ Warehouse)
  // ========================================================
 async create(companyId: number, dto: CreateProductDto & { warehouseId?: number }, userId: number) {
    // 🌟 ดึง warehouseId ออกมาจาก dto (ถ้ามีส่งมา)
    const { images, variants, warehouseId, ...productData } = dto as any;
    
    // ตั้งค่าเริ่มต้น (ป้องกัน undefined)
    const sku = dto.sku || `PRD-${Date.now()}`;
    const name = dto.name || 'Untitled Product';
    const price = dto.price ?? 0; 
    
    // ดึงข้อมูลลูกจากแหล่งที่ถูกต้อง
    const rawVariants = (variants && variants.length > 0) ? variants : (dto.variantAttributes?.groups || []);

    // 🌟 1. ดักจับ URL รูปภาพที่ถูกแบ่งไปให้ตัวลูกแล้ว
    const variantImageUrls = new Set<string>();
    if (Array.isArray(rawVariants)) {
      rawVariants.forEach((v: any) => {
        const vImages = v.images || (v.imageUrls ? v.imageUrls.map((url: string) => ({ url })) : []);
        vImages.forEach((img: any) => {
          if (img.url) variantImageUrls.add(img.url);
        });
      });
    }

    // 🌟 2. กรองรูปภาพของกล่องแม่ (ตัดรูปของลูกออกไป จะได้ไม่ซ้ำ)
    const filteredParentImages = images ? images.filter(img => !variantImageUrls.has(img.url)) : undefined;

    // 🌟 3. สร้างข้อมูลลง Database
    const newProduct = await this.prisma.comProduct.create({
      data: {
        ...productData, 
        sku, 
        name, 
        price, 
        companyId, 
        createdById: userId,
        warehouseId: warehouseId || undefined, // 🏭 บันทึกคลังสินค้าหลักให้ตัวแม่
        
        // บันทึกรูปกล่องแม่ที่ถูกหักลบแล้ว
        images: (filteredParentImages && filteredParentImages.length > 0) ? { 
          create: filteredParentImages.map((img, index) => ({
            // 🚩 แก้ไข: ส่ง companyId เข้าไปใน prepareImageData ด้วย
            ...this.prepareImageData(companyId, img),
            isMain: index === 0, 
            sortOrder: index
          })) 
        } : undefined,

        // 📦 บันทึกสินค้าลูก
        variants: (Array.isArray(rawVariants) && rawVariants.length > 0) ? {
          create: rawVariants.map((v: any, index: number) => {
            // ดึงรูปลูกมาเตรียมไว้
            const variantImages = v.images || (v.imageUrls ? v.imageUrls.map((url: string) => ({ url })) : []);
            
            return {
              companyId, 
              createdById: userId,
              sku: v.sku || `${sku}-V${index + 1}`,
              name: v.name || `${name} - ${index + 1}`,
              price: v.price ?? 0, 
              status: v.status || dto.status || 'PUBLISHED',
              variantAttributes: v.attributes || v.variantAttributes || {}, 
              stockQty: v.stockQty ?? 0,
              categoryId: dto.categoryId,
              visibilityCode: dto.visibilityCode || 'PUBLIC',
              warehouseId: v.warehouseId || warehouseId || undefined, // 🏭 บันทึกคลังสินค้าให้ตัวลูก
              
              // บันทึกรูปของตัวลูก
              images: variantImages.length > 0 ? {
                create: variantImages.map((img: any, imgIndex: number) => ({
                  // 🚩 แก้ไข: ส่ง companyId เข้าไปใน prepareImageData ด้วย
                  ...this.prepareImageData(companyId, img),
                  isMain: imgIndex === 0,
                  sortOrder: imgIndex
                }))
              } : undefined
            };
          })
        } : undefined
      },
      include: { 
        images: { include: { tags: true } }, 
        variants: { include: { images: true } } // ดึงรูปตัวลูกออกมาด้วย
      }
    });

    // 🌟 4. ผูกรูปภาพ (Link Media)
    const allSavedImages = await this.prisma.comProductImage.findMany({
      where: { 
        OR: [
          { productId: newProduct.id }, 
          { product: { parentId: newProduct.id } }
        ],
        companyId: companyId // 🛡️ เพิ่มความปลอดภัย ล็อกเฉพาะของบริษัทนี้
      }
    });
    
    // สั่งรันเป็น Background Process
    Promise.all(allSavedImages.map(img => 
        this.storageService.linkMedia(companyId, img.url, 'PRODUCT', newProduct.id)
    )).catch((err) => {
      this.logger.error(`❌ Link Media Error: ${err.message}`);
    });

    return newProduct;
  }

  // ========================================================
  // 📝 2. อัปเดตสินค้า (ฉบับสมบูรณ์: คืนโควตา + ผูกไฟล์ + กรองรูปซ้ำ + รองรับ Warehouse)
  // ========================================================
 async update(id: number, companyId: number, dto: UpdateProductDto & { warehouseId?: number }, userId: number) {
    // 🛡️ 1. ตรวจสอบความถูกต้องของสินค้า (ล็อกด้วย id และ companyId)
    const existing = await this.prisma.comProduct.findUnique({ 
      where: { id, companyId }, 
      include: { images: true, variants: true } 
    });
    if (!existing) throw new NotFoundException('ไม่พบสินค้าที่ต้องการแก้ไข');

    // 🌟 2. เก็บประวัติรูปเดิมก่อนการแก้ไข (ล็อกเฉพาะของบริษัทตัวเอง)
    const oldImages = await this.prisma.comProductImage.findMany({
      where: { 
        OR: [{ productId: id }, { product: { parentId: id } }],
        companyId: companyId // 🏢 เพิ่มการล็อกบริษัท
      }
    });

    // 🌟 ดึงข้อมูลออกมาจาก dto
    const { images, variants, warehouseId, ...updateData } = dto as any;
    const rawVariants = (variants && variants.length > 0) ? variants : (dto.variantAttributes?.groups || []);

    // 🌟 3. ดักจับ URL รูปภาพที่ถูกแบ่งไปให้ตัวลูก
    const variantImageUrls = new Set<string>();
    if (Array.isArray(rawVariants)) {
      rawVariants.forEach((v: any) => {
        const vImages = v.images || (v.imageUrls ? v.imageUrls.map((url: string) => ({ url })) : []);
        vImages.forEach((img: any) => {
          if (img.url) variantImageUrls.add(img.url);
        });
      });
    }

    // 🌟 4. กรองรูปภาพของกล่องแม่ (ตัดรูปลูกออก)
    const filteredParentImages = images ? images.filter(img => !variantImageUrls.has(img.url)) : undefined;

    // 🌟 5. ดำเนินการอัปเดตลง Database
    const updatedProduct = await this.prisma.comProduct.update({
      where: { id },
      data: {
        ...updateData,
        warehouseId: warehouseId !== undefined ? warehouseId : (existing as any).warehouseId, 
        
        // อัปเดตรูปกล่องแม่
        images: filteredParentImages ? {
          deleteMany: { 
            id: { notIn: filteredParentImages.filter(img => img.id).map(img => img.id as number) } 
          },
          upsert: filteredParentImages.map((img, index) => {
            // 🚩 เรียกใช้ prepareImageData แบบใหม่ที่รับ companyId
            const imageData = this.prepareImageData(companyId, img);
            return {
              where: { id: img.id || 0 },
              create: { ...imageData, isMain: index === 0, sortOrder: index },
              update: {
                ...imageData,
                isMain: index === 0,
                sortOrder: index,
                // 🏷️ จัดการ Tags ให้รองรับระบบคีย์คู่ (companyId_name)
                tags: imageData.tags ? { set: [], connectOrCreate: imageData.tags.connectOrCreate } : undefined
              }
            }
          })
        } : undefined,

        // 📦 อัปเดตสินค้าลูก (Variants)
        variants: (Array.isArray(rawVariants) && rawVariants.length > 0) ? {
          deleteMany: {
            parentId: id,
            id: { notIn: rawVariants.filter((v: any) => v.id).map((v: any) => v.id as number) }
          },
          upsert: rawVariants.map((v: any, index: number) => {
            const variantImages = v.images || (v.imageUrls ? v.imageUrls.map((url: string) => ({ url })) : []);
            
            return {
              where: { id: v.id || 0 },
              create: {
                companyId, 
                createdById: userId,
                sku: v.sku || `${dto.sku || existing.sku}-V${index}`,
                name: v.name || `${dto.name || existing.name} - ${index + 1}`,
                price: v.price ?? 0,
                variantAttributes: v.attributes || v.variantAttributes || {},
                stockQty: v.stockQty || 0,
                categoryId: dto.categoryId || existing.categoryId,
                visibilityCode: dto.visibilityCode || existing.visibilityCode,
                warehouseId: v.warehouseId || warehouseId || (existing as any).warehouseId || undefined,
                images: variantImages.length > 0 ? {
                  create: variantImages.map((img: any, imgIndex: number) => ({
                    // 🚩 ส่ง companyId เข้าไปด้วย
                    ...this.prepareImageData(companyId, img), 
                    isMain: imgIndex === 0, 
                    sortOrder: imgIndex
                  }))
                } : undefined
              },
              update: {
                name: v.name, 
                sku: v.sku, 
                price: v.price ?? undefined,
                variantAttributes: v.attributes || v.variantAttributes || {},
                stockQty: v.stockQty,
                warehouseId: v.warehouseId !== undefined ? v.warehouseId : undefined,
                images: variantImages.length > 0 ? {
                  deleteMany: {}, // ล้างรูปเก่าของลูกทิ้งทั้งหมดก่อน
                  create: variantImages.map((img: any, imgIndex: number) => ({
                    // 🚩 ส่ง companyId เข้าไปด้วย
                    ...this.prepareImageData(companyId, img), 
                    isMain: imgIndex === 0, 
                    sortOrder: imgIndex
                  }))
                } : { deleteMany: {} }
              }
            };
          })
        } : undefined
      },
      include: { images: { include: { tags: true } }, variants: true }
    });

    // 🌟 6. ดึงรูปล่าสุดที่รอดชีวิต (ล็อกบริษัท)
    const newImages = await this.prisma.comProductImage.findMany({
      where: { 
        OR: [{ productId: id }, { product: { parentId: id } }],
        companyId: companyId
      }
    });

    // 🌟 7. หาว่ารูปไหนโดนลบทิ้งไปบ้าง และเรียกคืนโควตา
    const newUrls = new Set(newImages.map(img => img.url));
    const deletedImages = oldImages.filter(img => img.url && !newUrls.has(img.url));
    
    for (const img of deletedImages) {
      await this.storageService.restoreQuota(companyId, img.url);
    }

    // 🌟 8. ยืนยันการผูกไฟล์ใหม่ (Background Process)
    Promise.all(newImages.map(img => 
        this.storageService.linkMedia(companyId, img.url, 'PRODUCT', id)
    )).catch((err) => {
      this.logger.error(`❌ Link Media Error in Update: ${err.message}`);
    });

    return updatedProduct;
  }

async findAll(
    companyId: number, 
    search?: string, 
    categoryId?: number, 
    tag?: string, 
    userId?: number, 
    page: number = 1, 
    limit: number = 20
  ) {
    const skip = (page - 1) * limit;

    const allowedVisibility = await this.getAllowedVisibilityCodes(userId);
    const visibilityFilter: any = userId 
      ? { 
          OR: [
            { status: 'PUBLISHED', visibilityCode: { in: allowedVisibility } }, 
            { createdById: userId } 
          ] 
        }
      : { status: 'PUBLISHED', visibilityCode: { in: allowedVisibility } };

    const whereCondition: any = { 
      companyId,
      parentId: null, // ดึงเฉพาะ Level 1
      ...visibilityFilter
    };

    const andConditions: any[] = [];
    if (search) {
      andConditions.push({
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { sku: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } }
        ]
      });
    }
    if (categoryId) andConditions.push({ categoryId });
    if (tag) andConditions.push({ tags: { has: tag } });
    if (andConditions.length > 0) whereCondition.AND = andConditions;

    const [total, products] = await Promise.all([
      this.prisma.comProduct.count({ where: whereCondition }),
      this.prisma.comProduct.findMany({
        where: whereCondition,
        include: {
          images: { orderBy: { sortOrder: 'asc' }, include: { tags: true } },
          // 📂 Level 2: กล่องย่อย / รูปเดี่ยว
          variants: {
            where: visibilityFilter,
            include: {
              images: { orderBy: { sortOrder: 'asc' }, include: { tags: true } },
              // 🖼️ Level 3: รูปภาพในกล่องย่อย (หลาน)
              variants: {
                where: visibilityFilter,
                include: {
                  images: { orderBy: { sortOrder: 'asc' }, include: { tags: true } }
                },
                orderBy: { createdAt: 'asc' }
              }
            },
            orderBy: { createdAt: 'asc' }
          },
          tierPrices: true,
          category: true,
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' }, 
      })
    ]);

    return {
      data: products,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) }
    };
  }

async findOne(id: number, companyId: number, userId?: number) {
    const allowedVisibility = await this.getAllowedVisibilityCodes(userId);
    const visibilityFilter: any = userId 
      ? { OR: [{ status: 'PUBLISHED', visibilityCode: { in: allowedVisibility } }, { createdById: userId }] }
      : { status: 'PUBLISHED', visibilityCode: { in: allowedVisibility } };

    const product = await this.prisma.comProduct.findFirst({
      where: { id, companyId, ...visibilityFilter },
      include: {
        images: { orderBy: { sortOrder: 'asc' }, include: { tags: true } },
        tierPrices: { include: { tiers: { orderBy: { minQty: 'asc' } } } },
        category: true,
        unit: true,
        boxSize: true,
        variants: {
          where: visibilityFilter,
          include: {
            images: { orderBy: { sortOrder: 'asc' }, include: { tags: true } },
            variants: {
              where: visibilityFilter,
              include: { images: { orderBy: { sortOrder: 'asc' }, include: { tags: true } } }
            }
          },
          orderBy: { createdAt: 'asc' }
        },
        // 🌟 ดึงข้อมูลแม่เพื่อเอา "ราคากลาง"
        parent: {
          include: {
            tierPrices: { include: { tiers: { orderBy: { minQty: 'asc' } } } }
          }
        }
      }
    });

    if (!product) throw new NotFoundException(`ไม่พบสินค้า หรือคุณไม่มีสิทธิ์เข้าถึง`);

    // 💰 [Logic]: ถ้าเป็นตัวลูก ให้ยึดราคากลางและราคาส่งจากตัวแม่ 100%
    if (product.parentId && product.parent) {
      product.price = product.parent.price;
      product.tierPrices = product.parent.tierPrices;
    }

    return product;
  }

// ========================================================
  // 🔍 ค้นหาสินค้าด้วย SKU (รองรับ Security + Hierarchy + Price Fallback)
  // ========================================================
  async findBySku(sku: string, companyId: number, userId?: number) {
    // 🛡️ 1. ดึงสิทธิ์การมองเห็น (Dynamic ตามระดับสมาชิก หรือ Staff)
    const allowedVisibility = await this.getAllowedVisibilityCodes(userId);
    
    // 🛡️ 2. สร้าง Filter สำหรับสิทธิ์ (คนสร้างเห็นได้เสมอ / คนอื่นเห็นเฉพาะที่ Publish และตามระดับสิทธิ์)
    const visibilityFilter: any = userId 
      ? { 
          OR: [
            { status: 'PUBLISHED', visibilityCode: { in: allowedVisibility } }, 
            { createdById: userId } 
          ] 
        }
      : { 
          status: 'PUBLISHED', 
          visibilityCode: { in: allowedVisibility } 
        };

    // 📦 3. Query ข้อมูลพร้อมความสัมพันธ์ 3 ระดับ
    const product = await this.prisma.comProduct.findFirst({
      where: { 
        sku: sku, 
        companyId: companyId,
        ...visibilityFilter 
      },
      include: {
        images: { orderBy: { sortOrder: 'asc' }, include: { tags: true } },
        tierPrices: {
          include: { tiers: { orderBy: { minQty: 'asc' } } },
          orderBy: { effectiveFrom: 'desc' }
        },
        category: true,
        unit: true,
        boxSize: true,
        
        // 📂 Level 2: ดึงลูก (Variants)
        variants: {
          where: visibilityFilter,
          include: {
            images: { orderBy: { sortOrder: 'asc' }, include: { tags: true } },
            // 🖼️ Level 3: ดึงหลาน (Sub-Variants/Images)
            variants: {
              where: visibilityFilter,
              include: {
                images: { orderBy: { sortOrder: 'asc' }, include: { tags: true } }
              },
              orderBy: { createdAt: 'asc' }
            }
          },
          orderBy: { createdAt: 'asc' }
        },
        
        // 📦 Parent: ดึงข้อมูลตัวแม่เผื่อไว้สำหรับทำ Price Fallback
        parent: {
          include: {
            images: { orderBy: { sortOrder: 'asc' }, include: { tags: true } },
            tierPrices: { include: { tiers: true } }
          }
        }
      }
    });

    if (!product) {
      throw new NotFoundException(`ไม่พบสินค้า SKU: ${sku} หรือคุณไม่มีสิทธิ์เข้าถึงข้อมูลนี้`);
    }

    // ============================================================
    // 💰 4. [ลอจิกราคา Fallback]: ถ้าตัวสินค้าไม่มีราคา ให้ไปดึงจากตัวแม่มาโชว์
    // ============================================================
    let finalPrice = product.price;
    if (product.parentId && (!product.price || Number(product.price) === 0) && product.parent) {
      finalPrice = product.parent.price;
    }

    // 🎯 5. คืนข้อมูลพร้อมแปลงค่า Decimal เป็น Number เพื่อความสะดวกของ Frontend
    return {
      ...product,
      price: Number(finalPrice || 0),
      ratingAvg: Number(product.ratingAvg || 0),
      tierPrices: product.tierPrices.map(tp => ({
        ...tp,
        tiers: tp.tiers.map(t => ({
          ...t,
          unitPrice: Number(t.unitPrice)
        }))
      }))
    };
  }



// ========================================================
  // 🏷️ อัปเดต Tags ของรูปภาพหลายรูปพร้อมกัน (Bulk Update)
  // ========================================================
  async updateMultipleImagesTags(companyId: number, imageIds: number[], tags: string[]) {
    if (!imageIds || imageIds.length === 0) {
      return { success: false, message: 'ไม่มีรูปภาพที่ถูกเลือก' };
    }

    // 🌟 1. ลอจิกทำความสะอาด Tags (Sanitize & Split) แบบเดียวกับ AI
    const processTags = (rawTags: string[]): string[] => {
      if (!rawTags || !Array.isArray(rawTags)) return [];
      return rawTags
        .flatMap(t => String(t).split(',')) // แยกคำด้วยลูกน้ำ
        .map(t => t.trim())                 // ตัดช่องว่าง
        .filter(t => t.length > 0)          // ตัดค่าว่าง
        .filter((value, index, self) => self.indexOf(value) === index); // ตัดคำซ้ำ
    };

    const cleanedTags = processTags(tags);

    // 🌟 2. ลอจิกหาหรือสร้าง Tags (Find or Create) แบบ Multi-company
    const tagConnects: { id: number }[] = [];
    for (const tagName of cleanedTags) {
      // 🏢 ค้นหาโดยใช้คีย์คู่ (Composite Key) เฉพาะในบริษัทนี้
      const existingTag = await this.prisma.comTag.findUnique({
        where: { 
          companyId_name: {
            companyId: companyId,
            name: tagName
          }
        }
      });
      
      if (existingTag) {
        tagConnects.push({ id: existingTag.id });
      } else {
        // 🏢 สร้างใหม่โดยผูกกับบริษัทนี้
        const newTag = await this.prisma.comTag.create({
          data: { 
            companyId: companyId,
            name: tagName 
          }
        });
        tagConnects.push({ id: newTag.id });
      }
    }

    // 🛡️ 3. Security & Performance: คัดกรองเฉพาะรูปภาพที่เป็นของบริษัทนี้จริงๆ
    // 🚀 ปรับมาใช้เช็ค companyId ตรงๆ จากตารางรูปภาพเลย (เร็วกว่า Join ไปหา Product)
    const validImages = await this.prisma.comProductImage.findMany({
      where: { 
        id: { in: imageIds },
        companyId: companyId // 🏢 เช็คตรงๆ ได้เลยเพราะเราเพิ่มฟิลด์นี้ไปแล้ว
      },
      select: { id: true }
    });

    const validImageIds = validImages.map(img => img.id);

    if (validImageIds.length === 0) {
      throw new NotFoundException('ไม่พบรูปภาพที่สามารถแก้ไขได้ หรือคุณไม่มีสิทธิ์เข้าถึง');
    }

    // 📦 4. อัปเดตทีละรูปผ่าน Transaction (เพราะ Prisma updateMany อัปเดต relation ไม่ได้)
    await this.prisma.$transaction(
      validImageIds.map(id => 
        this.prisma.comProductImage.update({
          where: { id },
          data: {
            tags: {
              set: [], // เคลียร์ Tags เก่าออกก่อน
              connect: tagConnects // นำ Tags ใหม่ผูกเข้าไป
            }
          }
        })
      )
    );

    return { 
      success: true, 
      message: `อัปเดต Tags สำเร็จ ${validImageIds.length} รูปภาพ`,
      tags: cleanedTags
    };
  }

  // ========================================================
  // 🏷️ อัปเดต Tags ของรูปภาพเดียว (Single Update)
  // ========================================================
  async updateSingleImageTags(companyId: number, imageId: number, tags: string[]) {
    // 🌟 1. ลอจิกทำความสะอาด Tags (Sanitize & Split)
    const processTags = (rawTags: string[]): string[] => {
      if (!rawTags || !Array.isArray(rawTags)) return [];
      return rawTags
        .flatMap(t => String(t).split(',')) // แยกคำด้วยลูกน้ำ
        .map(t => t.trim())                 // ตัดช่องว่างหน้า-หลัง
        .filter(t => t.length > 0)          // ตัดค่าว่างทิ้ง
        .filter((value, index, self) => self.indexOf(value) === index); // ตัดคำซ้ำ
    };

    const cleanedTags = processTags(tags);

    // 🌟 2. ลอจิกหาหรือสร้าง Tags (Find or Create) โดยล็อกตาม CompanyId
    const tagConnects: { id: number }[] = [];
    
    for (const tagName of cleanedTags) {
      // 🏢 ค้นหาโดยใช้คีย์คู่ (Composite Key) ของบริษัทตัวเอง
      let tag = await this.prisma.comTag.findUnique({
        where: { 
          companyId_name: {
            companyId: companyId,
            name: tagName
          }
        }
      });
      
      // 🏢 ถ้าไม่มี ให้สร้างใหม่ภายใต้ ID บริษัทนี้
      if (!tag) {
        tag = await this.prisma.comTag.create({
          data: { 
            companyId: companyId,
            name: tagName 
          }
        });
      }
      
      tagConnects.push({ id: tag.id });
    }

    // 🌟 3. อัปเดตผูก Tags เข้ากับรูปภาพ (ใช้ set เพื่อแทนที่ค่าเดิมทั้งหมด)
    return this.prisma.comProductImage.update({
      where: { id: imageId },
      data: {
        tags: {
          set: [], // ล้างค่าเก่า
          connect: tagConnects // เชื่อมค่าใหม่ที่สร้าง/หามาได้
        }
      },
      include: { tags: true }
    });
  }

 // ========================================================
  // ✂️ ถอดสินค้าลูกออกจากกลุ่ม (และคืนราคาแม่ให้)
  // ========================================================
  async removeVariantsFromGroup(companyId: number, childProductIds: number[]) {
    if (!childProductIds || childProductIds.length === 0) {
      throw new BadRequestException('กรุณาระบุรหัสสินค้าที่ต้องการถอดออกจากกลุ่ม');
    }

    return await this.prisma.$transaction(async (tx) => {
      // 1. ดึงข้อมูลลูกเพื่อหาตัวแม่ พร้อมรูปภาพของตัวลูก
      const firstChild = await tx.comProduct.findFirst({
        where: { id: childProductIds[0], companyId, parentId: { not: null } },
        include: { parent: { select: { id: true, price: true } } } 
      });

      if (!firstChild || !firstChild.parent) {
        return { success: false, message: 'ไม่พบสินค้า หรือสินค้านี้ไม่ได้อยู่ในกลุ่มใดๆ' };
      }

      // 🌟 2. ย้ายรูปภาพของลูกกลับไปให้แม่ (เปลี่ยน productId เป็นของแม่)
      await tx.comProductImage.updateMany({
         where: { productId: { in: childProductIds } },
         data: { productId: firstChild.parent.id }
      });

      // 3. ถอดลูกออก และ "คืนราคาของแม่" ให้ติดตัวลูกไปด้วย
      const updateResult = await tx.comProduct.updateMany({
        where: { id: { in: childProductIds }, companyId },
        data: { 
          parentId: null,
          price: firstChild.parent.price || 0 
        }
      });

      return { success: true, message: `ถอดสินค้า ${updateResult.count} รายการ และคืนรูปภาพให้แม่เรียบร้อยแล้ว` };
    });
  }

  // ========================================================
  // 💥 สลายกลุ่มทิ้ง (และคืนราคาแม่ + รูปภาพ ให้ลูกทุกคน)
  // ========================================================
  async dissolveVariantGroup(companyId: number, parentId: number) {
    return await this.prisma.$transaction(async (tx) => {
      const parent = await tx.comProduct.findFirst({
        where: { id: parentId, companyId }
      });

      if (!parent) throw new NotFoundException('ไม่พบกลุ่มสินค้าที่ต้องการสลาย');

      // 🌟 1. ก่อนสลายกลุ่ม ถ้าตัวแม่มีรูป ให้ย้ายรูปทั้งหมดไปให้ตัวลูกตัวแรก (หรือตัวลูกทั้งหมดถ้าทำได้)
      // ในบริบทนี้ การสลายกลุ่มคือการลบตัวแม่ทิ้ง ดังนั้นเราจะย้ายรูปของแม่และลูกทั้งหมด ไปเป็นของลูกตัวแรกเพื่อไม่ให้รูปหาย
      const firstChild = await tx.comProduct.findFirst({
         where: { parentId: parent.id, companyId }
      });

      if(firstChild) {
         // ย้ายรูปลูกทุกคนและรูปแม่ ไปกระจุกที่ลูกคนแรกก่อน แล้วค่อยสลาย
         await tx.comProductImage.updateMany({
            where: { 
              OR: [ { productId: parent.id }, { product: { parentId: parent.id } } ]
            },
            data: { productId: firstChild.id }
         });
      }

      // 2. ถอดลูกทุกคนออก และคืนราคาแม่ให้
      await tx.comProduct.updateMany({
        where: { parentId: parent.id, companyId },
        data: { 
          parentId: null,
          price: parent.price 
        }
      });

      // 3. ลบตัวแม่ทิ้ง
      await tx.comProduct.delete({
        where: { id: parentId }
      });

      return { success: true, message: 'สลายกลุ่มสินค้าและจัดการรูปภาพเรียบร้อยแล้ว' };
    });
  }

// ========================================================
  // 🗑️ ลบสินค้า (ลบตัวแม่ + ตัวลูก + หลาน + คืนโควตารูปภาพทั้งหมด)
  // ========================================================
  async remove(id: number, companyId: number) {
    // 1. กวาดข้อมูลลงลึกถึง Level 3 (หลาน) เพื่อเอาภาพมาคืนโควตาให้ครบ
    const product = await this.prisma.comProduct.findFirst({
      where: { id, companyId },
      include: { 
        images: true,
        variants: {
          include: { 
            images: true,
            variants: { include: { images: true } } // 🌟 กวาดถึงหลาน
          }
        }
      }
    });

    if (!product) throw new NotFoundException('ไม่พบสินค้า');

    // 2. รวบรวม ID และ รูปภาพทั้งหมดของทั้งตระกูล
    const allProductIds = [id];
    const allImages = [...product.images];
    const allFeaturedImages = [product.featuredImageUrl];

    for (const v1 of product.variants) {
      allProductIds.push(v1.id);
      allImages.push(...v1.images);
      allFeaturedImages.push(v1.featuredImageUrl);
      if (v1.variants) {
        for (const v2 of v1.variants) {
          allProductIds.push(v2.id);
          allImages.push(...v2.images);
          allFeaturedImages.push(v2.featuredImageUrl);
        }
      }
    }

    // 3. ตรวจสอบการผูกกับออเดอร์
    const [orderCount, reviewCount, wishlistCount] = await Promise.all([
      this.prisma.comOrderItem.count({ where: { productId: { in: allProductIds } } }).catch(() => 0),
      this.prisma.comProductReview.count({ where: { productId: { in: allProductIds } } }).catch(() => 0),
      this.prisma.comWishlist.count({ where: { productId: { in: allProductIds } } }).catch(() => 0),
    ]);

    if (orderCount > 0 || reviewCount > 0 || wishlistCount > 0) {
      throw new BadRequestException(`ไม่สามารถลบได้! สินค้าหรือตัวเลือกย่อยมีประวัติถูกใช้งานแล้ว กรุณาใช้การเปลี่ยนสถานะเป็น "ยกเลิกการขาย" แทน`);
    }

    // 🌟 4. คืนโควตารูปภาพทั้งหมด
    for (const image of allImages) {
      if (image.url) await this.storageService.restoreQuota(companyId, image.url);
    }
    for (const url of allFeaturedImages.filter(Boolean)) {
       // @ts-ignore
       await this.storageService.restoreQuota(companyId, url);
    }

    // 🗑️ 5. ลบตาราง (ทำจากล่างขึ้นบน: หลาน -> ลูก -> แม่)
    return await this.prisma.$transaction(async (tx) => {
      const v1Ids = product.variants.map(v => v.id);
      if (v1Ids.length > 0) {
        await tx.comProduct.deleteMany({ where: { parentId: { in: v1Ids }, companyId } });
      }
      if (product.variants.length > 0) {
        await tx.comProduct.deleteMany({ where: { parentId: id, companyId } });
      }
      return await tx.comProduct.delete({ where: { id, companyId } });
    });
  }

 async importProducts(companyId: number, data: any[]) {
    const results = { success: 0, failed: 0, errors: [] as string[] }; 
    for (const item of data) {
      try {
        const slug = await this.ensureUniqueSlug(item.slug || this.generateSlug(item.name));
        await this.prisma.comProduct.create({
          data: {
            companyId, sku: item.sku, name: item.name, brand: item.brand, slug,
            // 🌟 เติม as any เพื่อให้ผ่านกฎของ TypeScript
            price: new Prisma.Decimal(Number(item.price) || 0),
            status: (ProductStatus.PUBLISHED as ProductStatus),
            featuredImageUrl: item.imageUrl
          }
        });
        results.success++;
      } catch (e: any) {
        results.failed++;
        results.errors.push(`${item.sku}: ${e.message}`);
      }
    }
    return results;
  }

 // ========================================================
  // 🖼️ อัปเดตข้อมูล Metadata และ Tags ของรูปภาพ
  // ========================================================
 async updateImageMetadata(companyId: number, imageId: number, dto: { displayName?: string, tags?: string[] }) {
    // 🛡️ 1. Security & Performance: ตรวจสอบสิทธิ์โดยใช้ companyId ที่ตารางรูปภาพโดยตรง (เร็วกว่า Join)
    const existingImage = await this.prisma.comProductImage.findFirst({
      where: { 
        id: imageId, 
        companyId: companyId // 🏢 เช็คตรงๆ ได้เลยเพราะเราเพิ่มฟิลด์นี้ไปแล้ว
      }
    });

    if (!existingImage) throw new NotFoundException('ไม่พบรูปภาพ หรือคุณไม่มีสิทธิ์เข้าถึง');

    let tagConnects: { id: number }[] | undefined = undefined;

    // 🌟 2. นำลอจิกทำความสะอาด Tags มาใช้ตรงนี้ด้วย
    if (dto.tags && Array.isArray(dto.tags)) {
      const processTags = (rawTags: string[]): string[] => {
        return rawTags
          .flatMap(t => String(t).split(','))
          .map(t => t.trim())
          .filter(t => t.length > 0)
          .filter((value, index, self) => self.indexOf(value) === index);
      };

      const cleanedTags = processTags(dto.tags);
      tagConnects = [];

      // 🌟 3. ลอจิกหาหรือสร้าง Tags (Find or Create) แบบ Multi-company
      for (const tagName of cleanedTags) {
        // 🏢 ค้นหาโดยใช้คีย์คู่ (Composite Key) เฉพาะในบริษัทนี้
        let tag = await this.prisma.comTag.findUnique({
          where: { 
            companyId_name: {
              companyId: companyId,
              name: tagName
            }
          }
        });
        
        // 🏢 ถ้าไม่มีให้สร้างใหม่ภายใต้ ID บริษัทนี้
        if (!tag) {
          tag = await this.prisma.comTag.create({ 
            data: { 
              companyId: companyId,
              name: tagName 
            } 
          });
        }
        
        tagConnects.push({ id: tag.id });
      }
    }

    // 🌟 4. อัปเดตข้อมูล Metadata กลับไปที่รูปภาพ
    return await this.prisma.comProductImage.update({
      where: { id: imageId },
      data: {
        displayName: dto.displayName,
        tags: tagConnects ? { set: [], connect: tagConnects } : undefined
      },
      include: { tags: true }
    });
  }

 // 🌟 1. เพิ่มพารามิเตอร์ images?: any[] เข้าไปในวงเล็บ
 async groupProductsIntoVariant(companyId: number, parentName: string, childProductIds: number[], currentUserId: number, images?: any[]) {
    if (!childProductIds || childProductIds.length === 0) {
      throw new BadRequestException('กรุณาเลือกสินค้าอย่างน้อย 1 รายการเพื่อจัดกลุ่ม');
    }

    return await this.prisma.$transaction(async (tx) => {
      // 1. หาข้อมูลสินค้าตัวแรกเพื่อเป็นต้นแบบ (Category, สิทธิ์การเห็น)
      // 🛡️ ล็อกด้วย companyId เพื่อความปลอดภัย (Anti-IDOR)
      const firstChild = await tx.comProduct.findFirst({
        where: { id: childProductIds[0], companyId }
      });

      if (!firstChild) throw new NotFoundException('ไม่พบข้อมูลสินค้าที่ต้องการจัดกลุ่ม');

      // 2. สร้างสินค้า "กล่องใหญ่" (Parent) พร้อมผูกรูปภาพ
      const newParent = await tx.comProduct.create({
        data: {
          companyId, // 🏢 กำหนดบริษัทเจ้าของสินค้าตัวแม่
          createdById: currentUserId,
          name: parentName, 
          sku: `GRP-${Date.now()}`, 
          price: firstChild.price, 
          status: firstChild.status,
          visibilityCode: firstChild.visibilityCode,
          categoryId: firstChild.categoryId,
          
          // 🌟 แก้ไข: เรียกใช้ prepareImageData พร้อมส่ง companyId เป็นพารามิเตอร์ตัวแรก
          images: (images && images.length > 0) ? {
            create: images.map(img => this.prepareImageData(companyId, img))
          } : undefined
        }
      });

      // 3. อัปเดตตัวลูกทั้งหมด: ผูกหาแม่ และ "ล้างราคาตัวเอง" ให้เป็น 0
      // 🛡️ ล็อกด้วย companyId เพื่อให้มั่นใจว่าจะมีผลเฉพาะกับสินค้าของบริษัทนี้เท่านั้น
      await tx.comProduct.updateMany({
        where: { 
          id: { in: childProductIds }, 
          companyId 
        },
        data: { 
          parentId: newParent.id,
          price: 0 
        }
      });

      return { 
        success: true, 
        message: `จัดกลุ่มสำเร็จ สินค้าลูกจะยึดราคากลางจาก ${parentName}`, 
        parentId: newParent.id 
      };
    });
  }


  // ========================================================
  // 🏷️ เพิ่มช่วงราคา (Tier Price) (บล็อกการเพิ่มที่ตัวลูก)
  // ========================================================
 async addTierPrice(productId: number, companyId: number, dto: CreateProductPriceSetDto) {
    // 🛡️ 1. ตรวจสอบก่อนว่าเป็นสินค้าของบริษัทนี้จริง และเป็นสินค้าตัวแม่หรือไม่
    const product = await this.prisma.comProduct.findUnique({
      where: { 
        id: productId, 
        companyId // 🏢 ล็อกบริษัทเพื่อความปลอดภัย
      }
    });

    if (!product) throw new NotFoundException('ไม่พบสินค้า');
    
    // 🌟 กฎเหล็ก: ราคาส่งต้องผูกกับกล่องแม่เท่านั้น
    if (product.parentId) {
      throw new BadRequestException('ไม่สามารถเพิ่มราคาส่งให้สินค้าตัวเลือก (Variant) ได้ กรุณาเพิ่มที่สินค้ากล่องใหญ่เท่านั้น');
    }

    // 2. บันทึกข้อมูลราคาส่งพร้อมกำหนดสิทธิ์บริษัท
    return await this.prisma.comProductPriceSet.create({
      data: {
        productId,
        companyId, // 🏢 เพิ่มเพื่อให้รองรับ Multi-company (Header)
        effectiveFrom: new Date(dto.effectiveFrom),
        effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : null,
        note: dto.note,
        isActive: dto.isActive !== undefined ? dto.isActive : true,
        tiers: {
          create: dto.tiers.map((t: any) => ({
            companyId, // 🏢 เพิ่มที่ระดับ Tier ด้วย เพื่อความเร็วในการคำนวณราคาและทำรายงาน
            minQty: t.minQty,
            unitPrice: t.unitPrice
          }))
        }
      },
      include: { tiers: true }
    });
  }

  // ========================================================
  // 🗑️ ลบช่วงราคา (Tier Price) (บล็อกที่ตัวลูก)
  // ========================================================
  async removeTierPrice(productId: number, priceSetId: number, companyId: number) {
    // 🛡️ ตรวจสอบก่อนว่าเป็นตัวลูกหรือไม่
    const product = await this.prisma.comProduct.findUnique({
      where: { id: productId, companyId }
    });

    if (!product) throw new NotFoundException('ไม่พบสินค้า');
    if (product.parentId) {
      throw new BadRequestException('ไม่อนุญาตให้ลบราคาส่งผ่านสินค้าตัวเลือก (Variant) กรุณาจัดการที่สินค้ากล่องใหญ่เท่านั้น');
    }

    const priceSet = await this.prisma.comProductPriceSet.findFirst({
      where: { id: priceSetId, productId }
    });
    if (!priceSet) throw new NotFoundException('ไม่พบข้อมูลราคาส่งที่ต้องการลบ');

    // ใช้ Transaction เพื่อลบ Tiers ย่อยก่อน แล้วค่อยลบตัวแม่
    await this.prisma.$transaction([
      this.prisma.comProductTierPrice.deleteMany({ where: { priceSetId } }),
      this.prisma.comProductPriceSet.delete({ where: { id: priceSetId } })
    ]);

    return { success: true, message: 'ลบราคาส่งเรียบร้อยแล้ว' };
  }
  
// ========================================================
  // 💰 คำนวณราคาขาย (รองรับ Price Fallback จากตัวแม่)
  // ========================================================
  async getPriceAtDate(productId: number, qty: number, date: Date = new Date()) {
    // 1. หาข้อมูลสินค้าก่อนว่ามีแม่ไหม
    const product = await this.prisma.comProduct.findUnique({
      where: { id: productId },
      select: { id: true, price: true, parentId: true }
    });

    if (!product) return 0;

    // 🌟 หัวใจสำคัญ: ถ้าเป็นลูก ให้ไปดึงราคา/ราคาส่ง จาก ID ของตัวแม่แทน
    const targetProductId = product.parentId || product.id;

    // 2. ค้นหาราคาส่ง (Tier Price) ที่มีผลบังคับใช้ ณ วันที่ระบุ
    const priceSet = await this.prisma.comProductPriceSet.findFirst({
      where: {
        productId: targetProductId,
        isActive: true,
        effectiveFrom: { lte: date },
        OR: [
          { effectiveTo: null }, // 🌟 แก้ไขเป็น effectiveTo ตาม Prisma Schema
          { effectiveTo: { gte: date } } // 🌟 แก้ไขเป็น effectiveTo
        ]
      },
      include: {
        tiers: {
          where: { minQty: { lte: qty } },
          orderBy: { minQty: 'desc' },
          take: 1
        }
      },
      orderBy: { effectiveFrom: 'desc' }
    });

    // 3. ถ้าเจอช่วงราคาส่งให้ใช้ราคานั้น ถ้าไม่เจอให้ใช้ราคากลาง (ของแม่)
    if (priceSet && priceSet.tiers && priceSet.tiers.length > 0) {
      return Number(priceSet.tiers[0].unitPrice);
    }

    // กรณีไม่เจอราคาส่ง ต้องไปดึงราคากลางจาก targetProductId (ซึ่งอาจเป็นแม่)
    if (product.parentId) {
      const parentProduct = await this.prisma.comProduct.findUnique({
        where: { id: product.parentId },
        select: { price: true }
      });
      return Number(parentProduct?.price || 0);
    }

    return Number(product.price || 0);
  }

// ========================================================
  // 🔄 อัปเดต Cache ราคา (ล็อกเป้าหมายไปที่กล่องแม่เท่านั้น)
  // ========================================================
  async refreshProductPriceCache(productId: number) {
    // 1. ตรวจสอบสินค้าก่อน
    const product = await this.prisma.comProduct.findUnique({
      where: { id: productId },
      select: { id: true, parentId: true, price: true }
    });

    if (!product) throw new NotFoundException('ไม่พบสินค้า');

    // 🌟 2. Guardrail: ถ้าเป็น ID ตัวลูก ให้สลับเป้าหมายไปทำ Cache ที่ "ตัวแม่" ทันที
    const targetProductId = product.parentId || product.id;

    // 3. ดึงราคากลาง และ ราคาส่ง (Tier Price) ที่ Active อยู่ของ "ตัวแม่"
    const activePriceSets = await this.prisma.comProductPriceSet.findMany({
      where: {
        productId: targetProductId,
        isActive: true,
        OR: [
          { effectiveTo: null },
          { effectiveTo: { gte: new Date() } }
        ]
      },
      include: {
        tiers: { orderBy: { unitPrice: 'asc' } } // เรียงหาค่าที่ถูกที่สุด
      }
    });

    // 4. (ส่วนคำนวณ Cache)
    // ตรงนี้ขึ้นอยู่กับว่าระบบของคุณมีฟิลด์เก็บ Cache ราคาต่ำสุด/สูงสุด หรือไม่ 
    // ตัวอย่าง: การหา "ราคาที่ถูกที่สุด" เพื่อเอาไปแสดงว่า "เริ่มต้นที่ XXX บาท"
    let minPrice = Number(product.price || 0);

    if (activePriceSets.length > 0) {
      // ดึงราคาที่ถูกที่สุดจากทุก Tier ที่เจอ
      const allTierPrices = activePriceSets.flatMap(ps => ps.tiers.map(t => Number(t.unitPrice)));
      if (allTierPrices.length > 0) {
         minPrice = Math.min(...allTierPrices);
      }
    }

    /* * 💡 หากใน Database (schema.prisma) ของคุณมีฟิลด์สำหรับเก็บ Cache 
     * เช่น minPrice, maxPrice, หรือ defaultPrice สามารถใช้ Prisma อัปเดตตรงนี้ได้เลย
     * ตัวอย่าง:
     * await this.prisma.comProduct.update({
     * where: { id: targetProductId },
     * data: { cachedMinPrice: minPrice } 
     * });
     */

    return { 
      success: true, 
      message: `รีเฟรชราคา Cache ของสินค้ากล่องแม่ (ID: ${targetProductId}) เรียบร้อยแล้ว`,
      calculatedMinPrice: minPrice
    };
  }

// ในไฟล์ products.service.ts -> ฟังก์ชัน addImage()
async addImage(productId: number, companyId: number, dto: ProductImageDto) {
    // 🛡️ 1. ตรวจสอบสิทธิ์ว่าสินค้าเป็นของบริษัทนี้จริงๆ
    await this.findOne(productId, companyId);

    // 🚩 [แก้ไข] ส่ง companyId เข้าไปด้วยเพื่อให้สอดคล้องกับพารามิเตอร์ใหม่
    const prepared = this.prepareImageData(companyId, dto);

    // 🛡️ 2. นับจำนวนรูปที่มีอยู่เดิม (ล็อกด้วย companyId เพื่อความแม่นยำ)
    const count = await this.prisma.comProductImage.count({ 
      where: { 
        productId,
        companyId // 🏢 ล็อกบริษัทเสมอ
      } 
    });
    
    // 🌟 3. บันทึกข้อมูลรูปภาพใหม่
    const newImage = await this.prisma.comProductImage.create({
      data: { 
        ...prepared, 
        productId, 
        companyId, // 🏢 ระบุเจ้าของรูปภาพ (ป้องกัน Error จาก Schema)
        isMain: dto.isMain ?? (count === 0), 
        sortOrder: dto.sortOrder ?? count,
        aiStatus: null 
      } as any
    });

    // ❌ ส่วนการหักโควตา ลบออกตามที่บอสต้องการเรียบร้อยครับ
    // เพราะระบบจะไปหักที่ StorageService/UploadService แทน

    return newImage;
  }

// ========================================================
  // 🤖 ค้นหาสินค้าด้วย AI Text (รองรับ Security & Price Fallback)
  // ========================================================
  async searchByAiText(prompt: string, companyId: number, userId?: number) {
    // 🛡️ 1. ดึงสิทธิ์การมองเห็น (Security Guardrail)
    const allowedVisibility = await this.getAllowedVisibilityCodes(userId);
    const visibilityFilter: any = userId 
      ? { OR: [{ status: 'PUBLISHED', visibilityCode: { in: allowedVisibility } }, { createdById: userId }] }
      : { status: 'PUBLISHED', visibilityCode: { in: allowedVisibility } };

    // 🔍 2. ค้นหารูปภาพ 
    const rawImages = await this.prisma.comProductImage.findMany({
      where: {
        tags: { some: { name: { contains: prompt, mode: 'insensitive' } } },
        product: {
          companyId: companyId,
          ...visibilityFilter
        }
      },
      include: {
        tags: true, // 🌟 เพิ่มตรงนี้เพื่อให้ TypeScript และ Prisma รู้จัก Tags
        product: {
          include: {
            parent: { select: { id: true, price: true } }, 
            category: true
          }
        }
      },
      take: 20 
    });

    // 💰 3. แมปข้อมูลผลลัพธ์ และบังคับใช้กฎ Price Fallback
    const formattedResults = rawImages.map(img => {
      const prod = img.product;
      let finalPrice = prod.price;

      if (prod.parentId && prod.parent) {
        finalPrice = prod.parent.price;
      }

      return {
        imageId: img.id,
        imageUrl: img.url,
        tags: img.tags,
        product: {
          id: prod.id,
          name: prod.name,
          sku: prod.sku,
          price: Number(finalPrice || 0), 
          isVariant: !!prod.parentId,     
          parentId: prod.parentId
        }
      };
    });

    // 4. กรองรูปที่มาจากสินค้าตัวเดียวกันออก
    const uniqueProducts: any[] = []; // 🌟 เพิ่ม : any[] ตรงนี้เพื่อแก้ปัญหา type never
    const seenProductIds = new Set();
    
    for (const item of formattedResults) {
      const effectiveProductId = item.product.parentId || item.product.id;
      
      if (!seenProductIds.has(effectiveProductId)) {
        seenProductIds.add(effectiveProductId);
        uniqueProducts.push(item);
      }
    }

    return uniqueProducts;
  }


  // ========================================================
  // 📸 ค้นหาสินค้าด้วย Image Vector (รองรับ Security & Price Fallback)
  // ========================================================
  async searchByImageVector(imageBase64: string, companyId: number, userId?: number) { 
    try {
      const buffer = Buffer.from(imageBase64.replace(/^data:image\/\w+;base64,/, ""), 'base64');
      const vectorValues = await this.aiRuntime.generateImageEmbedding(buffer);
      
      if (!vectorValues || vectorValues.length !== 1536) return [];
      const vectorString = `[${vectorValues.join(',')}]`;

      if (companyId) {
        await this.aiRuntime.deductTokens(companyId, 50, 'PRODUCT_SEARCH_BOT', 'PRODUCT_SEARCH_IMAGE');
      }

      let matchingRecords: any[];
      try {
        matchingRecords = await this.prisma.$queryRawUnsafe<any[]>(`
          SELECT img."productId", MAX(1 - (img."imageVector" <=> $1::vector)) as similarity
          FROM com_product_images img
          JOIN com_products p ON img."productId" = p.id
          WHERE img."imageVector" IS NOT NULL AND p."companyId" = $2
          GROUP BY img."productId"
          ORDER BY similarity DESC
          LIMIT 15;
        `, vectorString, companyId);
      } catch (qErr) {
        matchingRecords = await this.prisma.$queryRawUnsafe<any[]>(`
          SELECT img."productId", MAX(1 - (img."imageVector" <=> $1::vector)) as similarity
          FROM "ComProductImage" img
          JOIN "ComProduct" p ON img."productId" = p.id
          WHERE img."imageVector" IS NOT NULL AND p."companyId" = $2
          GROUP BY img."productId"
          ORDER BY similarity DESC
          LIMIT 15;
        `, vectorString, companyId);
      }

      if (!matchingRecords || matchingRecords.length === 0) return [];

      const productIds = matchingRecords.map(record => record.productId);

      // 🛡️ Security Guardrail: ตรวจสอบสิทธิ์การมองเห็น (ของเดิมที่คุณทำไว้ดีมากแล้วครับ)
      const allowedVisibility = await this.getAllowedVisibilityCodes(userId);
      const whereCondition: any = {
        id: { in: productIds },
        companyId: companyId
      };

      if (!userId) {
        whereCondition.status = 'PUBLISHED';
        whereCondition.visibilityCode = { in: allowedVisibility };
      } else {
        whereCondition.OR = [
          { status: 'PUBLISHED', visibilityCode: { in: allowedVisibility } },
          { createdById: userId }
        ];
      }

      // 📦 1. ดึงข้อมูลสินค้าพร้อมตัวแม่ (เพื่อทำ Price Fallback)
      const rawProducts = await this.prisma.comProduct.findMany({
        where: whereCondition,
        include: {
          images: { orderBy: { sortOrder: 'asc' }, include: { tags: true } },
          parent: { select: { id: true, price: true } }, // 🌟 ดึงราคาแม่มาด้วย
          category: true
        }
      });

      // 💰 2. นำมาประมวลผล Price Fallback & จัดกลุ่มไม่ให้ซ้ำ (Deduplicate)
      const uniqueProducts: any[] = [];
      const seenProductIds = new Set();

      // 🔄 3. จัดเรียงผลลัพธ์ให้ตรงกับค่าความแม่นยำ (Similarity) จาก Vertex AI
      rawProducts.sort((a, b) => {
        const simA = matchingRecords.find(r => r.productId === a.id)?.similarity || 0;
        const simB = matchingRecords.find(r => r.productId === b.id)?.similarity || 0;
        return simB - simA;
      });

      for (const prod of rawProducts) {
        // ใช้ ID แม่เป็นตัวจัดกลุ่ม (ถ้าเป็นตัวลูก)
        const effectiveProductId = prod.parentId || prod.id;
        
        if (!seenProductIds.has(effectiveProductId)) {
          seenProductIds.add(effectiveProductId);
          
          // 🌟 Price Fallback Logic
          let finalPrice = prod.price;
          if (prod.parentId && prod.parent) {
            finalPrice = prod.parent.price;
          }

          // จัดโครงสร้างให้เรียบร้อยก่อนส่งคืนหน้าบ้าน
          uniqueProducts.push({
            ...prod,
            price: Number(finalPrice || 0),
            isVariant: !!prod.parentId // 🌟 ส่ง Flag ไปบอกหน้าบ้านว่าเป็นสินค้าลูก
          });
        }
      }

      return uniqueProducts;

    } catch (error: any) {
      this.logger.error(`❌ Error during AI Image Vector Search: ${error.message}`);
      return [];
    }
  }

  // ==========================================
  // [NEW] ลบรูปภาพ, ลบไฟล์จาก Cloud และคืนโควตา
  // ==========================================
 async removeImage(productId: number, imageId: number, companyId: number) {
    const image = await this.prisma.comProductImage.findFirst({
      where: { id: imageId, productId },
    });

    if (!image) throw new NotFoundException('ไม่พบรูปภาพ');

    // 🌟 คืนพื้นที่โควต้า และลบไฟล์ออกจาก Cloud (ผ่าน StorageService)
    if (image.url) {
      await this.storageService.restoreQuota(companyId, image.url);
    }

    // ลบ Record ออกจากฐานข้อมูลสินค้า
    return this.prisma.comProductImage.delete({ where: { id: imageId } });
  }

  // ========================================================
  // 🖼️ ดึงข้อมูลรูปภาพทั้งหมด (ระบบแกลลอรี่หลังบ้าน)
  // ========================================================
  async findAllImages(companyId: number, query: any) {
    const { page = 1, limit = 50, hasTags, aiStatus, search } = query;
    const skip = (page - 1) * limit;

    const whereCondition: any = {
      product: { companyId } // 🔒 ล็อกให้ดูได้เฉพาะรูปของบริษัทตัวเอง
    };

    // 🔍 1. ตัวกรอง: ค้นหารูปที่ "มี/ไม่มี" Tags
    if (hasTags === 'false') {
      whereCondition.tags = { none: {} };
    } else if (hasTags === 'true') {
      whereCondition.tags = { some: {} };
    }

    // 🤖 2. ตัวกรอง: ค้นหาตามสถานะ AI
    if (aiStatus) {
      whereCondition.aiStatus = aiStatus;
    }

    // ⌨️ 3. ค้นหาจากข้อความ (อัปเกรดให้ค้นหาจาก Tags ได้ด้วย!)
    if (search) {
      whereCondition.OR = [
        { fileName: { contains: search, mode: 'insensitive' } },
        { displayName: { contains: search, mode: 'insensitive' } },
        { product: { name: { contains: search, mode: 'insensitive' } } },
        // 🌟 เพิ่มให้ค้นหาจากชื่อ Tags ที่ AI สร้างให้ได้แล้ว!
        { tags: { some: { name: { contains: search, mode: 'insensitive' } } } } 
      ];
    }

    // ดึงข้อมูลพร้อมกับนับจำนวนรวม
    const [total, images] = await Promise.all([
      this.prisma.comProductImage.count({ where: whereCondition }),
      this.prisma.comProductImage.findMany({
        where: whereCondition,
        include: {
          tags: true, 
          // 🌟 เพิ่ม parentId เพื่อให้หน้าบ้านรู้ว่ารูปนี้เป็นของกล่องแม่หรือกล่องลูก
          product: { select: { id: true, name: true, sku: true, parentId: true } } 
        },
        orderBy: { id: 'desc' }, 
        skip: Number(skip),
        take: Number(limit),
      })
    ]);

    return {
      data: images,
      meta: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit)
      }
    };
  }


 // ========================================================
  // 🤝 สินค้าที่เกี่ยวข้อง (รองรับ Variant Inheritance & Security)
  // ========================================================
  async findRelatedProducts(productId: number, limit: number = 4, userId?: number) { 
    // 1. ดึงข้อมูลสินค้าปัจจุบัน (และตัวแม่) พร้อมดึงรูปภาพเพื่อเอา Tags ออกมา
    const currentProduct = await this.prisma.comProduct.findUnique({
      where: { id: productId },
      include: { 
        // 🌟 แก้ไข: ดึง Tags ผ่าน images แทน เพราะ Tags ผูกอยู่กับรูปภาพ
        images: { include: { tags: true } }, 
        parent: { include: { images: { include: { tags: true } } } } 
      } 
    });

    if (!currentProduct) return [];

    // 🌟 ฟังก์ชันเสริมช่วยดึง Tags ออกมาจากรูปภาพทุกรูปของสินค้า
    const extractTags = (prod: any) => {
      if (!prod || !prod.images) return [];
      const allTags: any[] = [];
      prod.images.forEach((img: any) => {
        if (img.tags) allTags.push(...img.tags);
      });
      // กรอง Tags ซ้ำออก
      return allTags.filter((value, index, self) => self.findIndex(t => t.id === value.id) === index);
    };

    // 2. ลอจิก "สืบทอดพันธุกรรม": เอาหมวดหมู่/แท็ก ของตัวแม่มาช่วยหา
    const targetCategoryId = currentProduct.categoryId || currentProduct.parent?.categoryId;
    
    // ดึง Tags จากตัวลูกก่อน ถ้าตัวลูกไม่มีรูป/ไม่มีแท็ก ให้ไปดึงจากตัวแม่
    let targetTags = extractTags(currentProduct);
    if (targetTags.length === 0 && currentProduct.parent) {
      targetTags = extractTags(currentProduct.parent);
    }
    
    const targetCompanyId = currentProduct.companyId;
    const excludeIds = [productId, currentProduct.parentId].filter(id => id !== null) as number[];

    // 🛡️ 3. เตรียมลอจิกตรวจสอบสิทธิ์
    const allowedVisibility = await this.getAllowedVisibilityCodes(userId);
    const visibilityFilter: any = userId 
      ? { OR: [{ status: 'PUBLISHED', visibilityCode: { in: allowedVisibility } }, { createdById: userId }] }
      : { status: 'PUBLISHED', visibilityCode: { in: allowedVisibility } };

    // 4. กำหนดเงื่อนไขการค้นหา
    const orConditions: any[] = [];
    if (targetCategoryId) {
      orConditions.push({ categoryId: targetCategoryId });
    }
    if (targetTags.length > 0) {
      // 🌟 แก้ไข: ค้นหาทะลุเข้าไปในรูปภาพของสินค้าตัวอื่นๆ ว่ามี Tags ตรงกันหรือไม่
      orConditions.push({ 
        images: { 
          some: { 
            tags: { 
              some: { id: { in: targetTags.map(t => t.id) } } 
            } 
          } 
        } 
      });
    }

    // 5. ประกอบเงื่อนไขหลัก (Where)
    const whereCondition: any = {
      id: { notIn: excludeIds },
      companyId: targetCompanyId,
      parentId: null, // โชว์เฉพาะกล่องหลัก (Level 1)
      ...visibilityFilter
    };

    if (orConditions.length > 0) {
      whereCondition.AND = [{ OR: orConditions }];
    }

    // 6. ดึงข้อมูลแบบ Deep Include 3 ระดับ
    const relatedProducts = await this.prisma.comProduct.findMany({
      where: whereCondition,
      include: {
        images: { orderBy: { sortOrder: 'asc' }, include: { tags: true } },
        tierPrices: {
            include: { tiers: { orderBy: { minQty: 'asc' } } },
            orderBy: { effectiveFrom: 'desc' }
        },
        category: true,
        variants: {
          where: visibilityFilter,
          include: {
            images: { orderBy: { sortOrder: 'asc' }, include: { tags: true } },
            variants: {
              where: visibilityFilter,
              include: { images: { orderBy: { sortOrder: 'asc' }, include: { tags: true } } }
            }
          },
          orderBy: { createdAt: 'asc' }
        }
      },
      take: limit,
      orderBy: { createdAt: 'desc' }
    });

    // 💰 7. แมปข้อมูลให้ price เป็น Number
    return relatedProducts.map(product => ({
      ...product,
      price: Number(product.price || 0),
      tierPrices: product.tierPrices.map(tp => ({
        ...tp,
        tiers: tp.tiers.map(t => ({
          ...t,
          unitPrice: Number(t.unitPrice)
        }))
      }))
    }));
  }




  // =========================================================
  // 👁️ ฟังก์ชันตรวจสอบสิทธิ์การมองเห็นสินค้าตามระดับสมาชิก
  // =========================================================
  private async getAllowedVisibilityCodes(memberId?: number, companyId?: number, shopId?: number): Promise<string[]> {
    // 1. ระดับพื้นฐานที่ทุกคน (รวมถึงคนที่ไม่ได้ล็อกอิน) สามารถเห็นได้
    const allowedCodes = new Set<string>(['ALL', 'GUEST']);

    if (!memberId) {
      return Array.from(allowedCodes);
    }

    // 2. ถ้าล็อกอินเข้ามาแล้ว อย่างน้อยจะได้สิทธิ์พื้นฐานของสมาชิก
    allowedCodes.add('NORMAL');
    allowedCodes.add('MEMBER');

    // 3. 🌟 ไปเช็คระดับสมาชิกลูกค้าจากตารางสมาชิกร้าน (CrmMemberShop)
    const queryWhere: any = { memberId };
    if (companyId) queryWhere.companyId = companyId;
    if (shopId) queryWhere.shopId = shopId;

    try {
      const shopMemberships = await this.prisma.crmMemberShop.findMany({
        where: queryWhere,
        select: { memberLevelCode: true }
      });

      // 4. เอา Level Code ทั้งหมดที่ลูกค้าคนนี้มี (จากสาขาต่างๆ) มารวมกัน
      for (const membership of shopMemberships) {
        if (membership.memberLevelCode) {
          allowedCodes.add(membership.memberLevelCode);
        }
      }
    } catch (e) {
      // ป้องกันกรณีฐานข้อมูลมีปัญหา ให้คืนค่าเท่าที่หาได้
    }

    return Array.from(allowedCodes);
  }



// ========================================================
  // 🛍️ ค้นหาสินค้าสำหรับหน้า Marketplace (Quick View / Product Detail)
  // ========================================================
  async findOneForMarketplace(id: number, userId?: number) {
    // 🛡️ 1. ลอจิกตรวจสอบสิทธิ์ (เหมือนหลังบ้านเป๊ะ)
    const allowedVisibility = await this.getAllowedVisibilityCodes(userId);
    
    const visibilityFilter: any = userId 
      ? { 
          OR: [
            { status: 'PUBLISHED', visibilityCode: { in: allowedVisibility } }, 
            { createdById: userId } 
          ] 
        }
      : { 
          status: 'PUBLISHED', 
          visibilityCode: { in: allowedVisibility } 
        };

    // 📦 2. ดึงข้อมูลสินค้า พร้อมตัวลูกและตัวแม่
    const product = await this.prisma.comProduct.findFirst({
      where: {
        id: id,
        ...visibilityFilter // 👈 ดักสิทธิ์การเห็นที่ตัวแม่
      },
      include: {
        images: { orderBy: { sortOrder: 'asc' }, include: { tags: true } },
        tierPrices: {
            include: { tiers: { orderBy: { minQty: 'asc' } } },
            orderBy: { effectiveFrom: 'desc' }
        },
        category: true,
        unit: true,     // เผื่อหน้าบ้านเอาไปโชว์ว่าขายเป็น "ชิ้น", "หลา", "เมตร"
        boxSize: true, 
        
        // 📂 ดึงข้อมูลตัวลูก (Variants) เพื่อให้หน้าบ้านเอาไปทำปุ่มเลือกสี/ลาย
        variants: {
          where: visibilityFilter, // 👈 ดักไม่ให้โชว์สี/ลายที่ยังเป็น Draft
          include: {
            images: { orderBy: { sortOrder: 'asc' }, include: { tags: true } },
            
            // 🖼️ ดึงลึกลงไปอีกชั้นเผื่อมี โครงสร้าง 3 ระดับ (กล่องแม่ -> กล่องย่อย -> รูป)
            variants: {
              where: visibilityFilter, // 👈 ดักสิทธิ์ระดับหลาน
              include: {
                images: { orderBy: { sortOrder: 'asc' }, include: { tags: true } }
              },
              orderBy: { createdAt: 'asc' }
            }
          },
          orderBy: { createdAt: 'asc' }
        },
        
        // 📦 ดึงข้อมูลตัวแม่เผื่อไว้ กรณีที่ลูกค้ากดเข้าลิงก์ตรงมาที่ตัวลูก
        parent: {
          include: {
            images: { orderBy: { sortOrder: 'asc' }, include: { tags: true } },
            tierPrices: { include: { tiers: true } }
          }
        }
      },
    });

    if (!product) throw new NotFoundException(`ไม่พบสินค้า หรือสินค้านี้สงวนสิทธิ์เฉพาะสมาชิกแต่ละระดับ`);
    
    // ==========================================
    // 💰 3. [ลอจิกราคา]: รองรับ "ราคายังคงดูที่ตัวแม่"
    // ==========================================
    let displayPrice = product.price;
    if (product.parentId && !product.price && product.parent) {
      displayPrice = product.parent.price; // ถ้าย่อยไม่มีราคา ให้ยืมราคาแม่มาใช้
    }

    // 🎯 4. คืนค่ากลับไปให้ Frontend (แปลง Decimal เป็น Number)
    return {
      ...product,
      price: Number(displayPrice || 0), // 👈 ใช้ราคาที่ผ่านการเช็ค Fallback แล้ว
      ratingAvg: Number(product.ratingAvg || 0),
      tierPrices: product.tierPrices.map(tp => ({
        ...tp,
        tiers: tp.tiers.map(t => ({
          ...t,
          unitPrice: Number(t.unitPrice)
        }))
      }))
    };
  }

async updateTierPriceSet(
    productId: number, 
    priceSetId: number, 
    companyId: number, 
    dto: Partial<CreateProductPriceSetDto>
  ) {
    // 🛡️ 1. ตรวจสอบสินค้าและสิทธิ์ตัวแม่ (Guardrail)
    const product = await this.prisma.comProduct.findUnique({
      where: { 
        id: productId, 
        companyId // 🏢 ล็อกเฉพาะของบริษัทตัวเอง
      }
    });

    if (!product) throw new NotFoundException('ไม่พบสินค้า');
    if (product.parentId) {
      throw new BadRequestException('ไม่สามารถแก้ไขราคาส่งผ่านสินค้าตัวเลือก (Variant) ได้ กรุณาจัดการที่สินค้ากล่องใหญ่เท่านั้น');
    }

    // 2. ตรวจสอบว่ามีชุดราคานี้จริง และเป็นของบริษัทนี้จริงๆ หรือไม่
    const priceSet = await this.prisma.comProductPriceSet.findFirst({
      where: { 
        id: priceSetId, 
        productId,
        companyId // 🏢 เช็คซ้ำอีกรอบเพื่อความปลอดภัยสูงสุด (Anti-IDOR)
      }
    });
    if (!priceSet) throw new NotFoundException('ไม่พบข้อมูลราคาส่ง');

    // 3. เตรียมข้อมูลสำหรับการอัปเดต
    return await this.prisma.comProductPriceSet.update({
      where: { id: priceSetId },
      data: {
        effectiveFrom: dto.effectiveFrom ? new Date(dto.effectiveFrom) : priceSet.effectiveFrom,
        effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : (dto.effectiveTo === null ? null : priceSet.effectiveTo),
        note: dto.note !== undefined ? dto.note : priceSet.note,
        isActive: dto.isActive !== undefined ? dto.isActive : priceSet.isActive,
        
        // 🌟 อัปเดตรายการขั้นราคา
        tiers: dto.tiers ? {
          deleteMany: {}, // 🗑️ ล้างขั้นราคาเดิมทิ้ง
          create: dto.tiers.map((t: any) => ({ 
            companyId, // 🏢 [สำคัญ] ทุกครั้งที่สร้าง Tier ใหม่ ต้องผูก CompanyId เสมอ
            minQty: t.minQty,
            unitPrice: t.unitPrice,
            maxQty: t.maxQty 
          }))
        } : undefined
      },
      include: { tiers: true }
    });
  }



 // ========================================================
  // 🖼️ ดึงรูปภาพทั้งหมดสำหรับหน้าร้านค้า (Marketplace Gallery Mode)
  // ========================================================
  async findAllMarketplaceImages(companyId: number, query: any, userId?: number) {
    const { page = 1, limit = 20, search } = query;
    const skip = (page - 1) * limit;

    // 🛡️ 1. ลอจิกตรวจสอบสิทธิ์ (Visibility Filter)
    const allowedVisibility = await this.getAllowedVisibilityCodes(userId);
    
    const productVisibilityFilter: any = userId 
      ? { 
          OR: [
            { status: 'PUBLISHED', visibilityCode: { in: allowedVisibility } },
            { createdById: userId } 
          ] 
        }
      : { 
          status: 'PUBLISHED', 
          visibilityCode: { in: allowedVisibility } 
        };

    // 📦 2. เงื่อนไขการดึงรูปภาพ 
    // ต้องตรวจสอบว่าสินค้าที่รูปนั้นสังกัดอยู่ (Product) ตรงตามเงื่อนไขสิทธิ์การมองเห็นด้วย
    const whereCondition: any = { 
      product: { 
        companyId,
        ...productVisibilityFilter // 👈 กรองรูปภาพตามสิทธิ์การเห็นของสินค้า
      } 
    };

    if (search) {
      whereCondition.OR = [
        { fileName: { contains: search, mode: 'insensitive' } },
        { displayName: { contains: search, mode: 'insensitive' } },
        // 🔍 ค้นหาลึกไปถึง Tags ของรูปภาพ
        { tags: { some: { name: { contains: search, mode: 'insensitive' } } } }
      ];
    }

    const [total, images] = await Promise.all([
      this.prisma.comProductImage.count({ where: whereCondition }),
      this.prisma.comProductImage.findMany({
        where: whereCondition,
        include: {
          // 🏷️ ดึงรายการ Tags ของรูปภาพออกมาด้วย เพื่อโชว์ที่หน้า Gallery
          tags: true, 
          product: { 
            select: { 
              id: true, 
              name: true, 
              sku: true, 
              price: true, 
              status: true, 
              createdById: true,
              parentId: true // 👈 ดึงมาเพื่อให้หน้าบ้านรู้ว่าเป็นสินค้าลูกของตัวไหน
            } 
          }
        },
        orderBy: { id: 'desc' }, 
        skip: Number(skip),
        take: Number(limit),
      })
    ]);

    return {
      data: images,
      meta: { 
        total, 
        page: Number(page), 
        limit: Number(limit), 
        totalPages: Math.ceil(total / limit) 
      }
    };
  }

}