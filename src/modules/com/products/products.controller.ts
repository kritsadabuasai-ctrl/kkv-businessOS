import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Patch, 
  Param, 
  Delete, 
  ParseIntPipe, 
  UseGuards, 
  Request, 
  Query,
  BadRequestException
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductImageDto } from './dto/product-image.dto';
import { CreateProductPriceSetDto } from './dto/product-tier-price.dto'; 
import { JwtAuthGuard } from '../../sec/auth/jwt-auth.guard'; // 🌟 อัปเดต Path
import { PermissionsGuard } from '../../sec/auth/permissions.guard'; // 🌟 อัปเดต Path
import { RequirePermissions } from '../../sec/auth/permissions.decorator'; // 🌟 อัปเดต Path
import { SubscriptionGuard } from '../../sec/auth/subscription.guard';
import { Public } from '../../sec/auth/public.decorator'; // 🌟 อัปเดต Path
import { AiTaggingService } from '../../int/ai-tagging/ai-tagging.service'; 
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('Products')
@Controller('com/products') // 🌟 เติม api/ ให้เป็นมาตรฐาน
@UseGuards(JwtAuthGuard, PermissionsGuard ,SubscriptionGuard) // 🌟 ล็อก 2 ชั้น (ยกเว้นตัวที่มี @Public)
export class ProductsController {
  constructor(
    private readonly service: ProductsService,
    private readonly aiTaggingService: AiTaggingService 
  ) {}

  // ========================================================
  // 🚀 1. STATIC & ACTION ROUTES (ต้องอยู่บนสุดป้องกันการทับกับ :id)
  // ========================================================

  @Post('import')
  @RequirePermissions('product:create')
  importProducts(@Body() data: any[], @Request() req) {
    return this.service.importProducts(req.user.companyId, data);
  }

  @Post('generate-description')
  @RequirePermissions('product:create')
  async generateDescription(@Body('productName') productName: string, @Request() req) { 
    if (!productName || productName.trim() === '') {
      throw new BadRequestException('กรุณาระบุชื่อสินค้า (productName) เพื่อให้ AI ประมวลผล');
    }
    try {
      const description = await this.service.generateProductDescription(productName, req.user.companyId);
      return { success: true, data: { description } };
    } catch (error : any) {
      throw new BadRequestException(error.message);
    }
  }

  @Public()
  @Post('search/text')
  searchByAiText(@Body('prompt') prompt: string, @Body('companyId') companyId: number, @Request() req) {
    if (!companyId) throw new BadRequestException('Missing companyId in body');
    // 🌟 ดึง ID ผู้ใช้ถ้ามีการล็อกอิน
    const currentUserId = req.user ? (req.user.id || req.user.userId || req.user.sub) : undefined;
    return this.service.searchByAiText(prompt, companyId, currentUserId); 
  }

  @Public()
  @Post('search/image')
  searchByAiImage(@Body('imageBase64') imageBase64: string, @Body('companyId') companyId: number, @Request() req) {
    if (!companyId) throw new BadRequestException('Missing companyId in body');
    const currentUserId = req.user ? (req.user.id || req.user.userId || req.user.sub) : undefined;
    return this.service.searchByImageVector(imageBase64, companyId, currentUserId); 
  }

  @Public()
  @Get('marketplace/list')
  findAllForMarketplace(
    @Request() req, 
    @Query('companyId') companyId: string, 
    @Query('search') search?: string,
    @Query('categoryId') categoryId?: string, 
    @Query('tag') tag?: string,
    @Query('page') page: string = '1',   
    @Query('limit') limit: string = '20' 
  ) {
    if (!companyId) throw new BadRequestException('กรุณาระบุ companyId สำหรับหน้าร้านค้า');
    const currentUserId = req.user ? (req.user.id || req.user.userId || req.user.sub) : undefined;
    
    return this.service.findAll(
      parseInt(companyId, 10), search, 
      categoryId ? parseInt(categoryId, 10) : undefined, 
      tag, currentUserId, 
      parseInt(page, 10), parseInt(limit, 10)
    );
  }

  @Public()
  @Get('marketplace/images')
  findAllMarketplaceImages(
    @Request() req, 
    @Query('companyId') companyId: string, 
    @Query() query: any
  ) {
    if (!companyId) throw new BadRequestException('กรุณาระบุ companyId สำหรับหน้าร้านค้า');
    const currentUserId = req.user ? (req.user.id || req.user.userId || req.user.sub) : undefined;
    return this.service.findAllMarketplaceImages(parseInt(companyId, 10), query, currentUserId);
  }

  @Public()
  @Get('marketplace/:id/related')
  async findRelatedProducts(@Param('id', ParseIntPipe) id: number, @Request() req) {
    const currentUserId = req.user ? (req.user.id || req.user.userId || req.user.sub) : undefined;
    return this.service.findRelatedProducts(id, 4, currentUserId); 
  }

  @Public()
  @Get('marketplace/:id')
  async findOneForMarketplace(@Param('id', ParseIntPipe) id: number, @Request() req) {
    const currentUserId = req.user ? (req.user.id || req.user.userId || req.user.sub) : undefined;
    return this.service.findOneForMarketplace(id, currentUserId);
  }

  @Get('images/gallery')
  @RequirePermissions('product:view')
  findAllImages(@Request() req, @Query() query: any) {
    return this.service.findAllImages(req.user.companyId, query);
  }

  @Post('images/tag-instantly')
  @RequirePermissions('product:update')
  async tagImagesInstantly(@Body('imageIds') imageIds: number[], @Request() req) {
    if (!imageIds || imageIds.length === 0) throw new BadRequestException('กรุณาเลือกรูปภาพอย่างน้อย 1 รูป');
    return this.aiTaggingService.tagImagesInstantly(req.user.companyId, imageIds);
  }

  @Post('images/tag-batch')
  @RequirePermissions('product:update')
  async tagImagesBatch(
    @Request() req,
    @Body('imageIds') imageIds?: number[]
  ) {
    return this.aiTaggingService.createBatchJob(req.user.companyId, imageIds);
  }

  @Patch('images/bulk-tags')
  @RequirePermissions('product:update')
  async updateMultipleImagesTags(@Body() dto: { imageIds: number[], tags: string[] }, @Request() req) {
    if (!dto.imageIds || dto.imageIds.length === 0) throw new BadRequestException('กรุณาเลือกรูปภาพอย่างน้อย 1 รูป');
    if (!dto.tags) throw new BadRequestException('รูปแบบข้อมูล Tags ไม่ถูกต้อง');
    return this.service.updateMultipleImagesTags(req.user.companyId, dto.imageIds, dto.tags);
  }

  @Get('sku/:sku')
  @RequirePermissions('product:view')
  findBySku(@Param('sku') sku: string, @Request() req) {
    // 🌟 ดึง userId จาก Token
    const currentUserId = req.user ? (req.user.id || req.user.userId || req.user.sub) : undefined;
    // 🌟 ส่ง currentUserId เข้าไปเป็น Parameter ตัวที่ 3
    return this.service.findBySku(sku, req.user.companyId, currentUserId);
  }

  // ========================================================
  // 📦 2. CORE CRUD ROUTES
  // ========================================================

  @Get()
  @RequirePermissions('product:view')
  findAll(
    @Request() req, 
    @Query('companyId') queryCompanyId?: string, 
    @Query('search') search?: string,
    @Query('categoryId') categoryId?: string, 
    @Query('tag') tag?: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20'              
  ) {
    const parsedCategoryId = categoryId ? parseInt(categoryId, 10) : undefined;
    const currentUserId = req.user ? (req.user.id || req.user.userId || req.user.sub) : undefined;
    const targetCompanyId = queryCompanyId ? parseInt(queryCompanyId, 10) : req.user?.companyId;

    // 🌟 ตรวจสอบลำดับพารามิเตอร์ให้ตรงกับ Service (ตัวที่ 5 คือ userId)
    return this.service.findAll(
      targetCompanyId, 
      search, 
      parsedCategoryId, 
      tag, 
      currentUserId, // 👈 userId อยู่ตรงนี้ ถูกต้องแล้ว
      parseInt(page, 10), 
      parseInt(limit, 10)
    );
  }

  @Post()
  @RequirePermissions('product:create')
  create(@Body() dto: CreateProductDto, @Request() req) {
    // ดึง User ID จาก Token
    const currentUserId = req.user.id || req.user.userId || req.user.sub;
    
    // 🌟 บังคับส่ง 3 ตัวแปรให้ Service นำไปใช้ (ป้องกันข้อมูลตกหล่น)
    return this.service.create(req.user.companyId, dto, currentUserId);
  }

  // API สำหรับดึงสินค้าลูก "บางตัว" ออกจากกลุ่ม
  // Method: PATCH /api/com/products/variants/remove
  // Body: { "childIds": [12, 15] }
  @Patch('variants/remove')
  @RequirePermissions('product:update')
  async removeVariantsFromGroup(
    @Request() req,
    @Body('childProductIds') childProductIds: number[] // 🌟 เปลี่ยนจาก childIds เป็น childProductIds ให้ตรงตามมาตรฐานชื่อตัวแปร
  ) {
    return this.service.removeVariantsFromGroup(req.user.companyId, childProductIds);
  }

  // API สำหรับสลายกลุ่มทิ้งทั้งยวง
  // Method: DELETE /api/com/products/variants/group/:parentId
  @Delete('variants/group/:parentId')
  @RequirePermissions('product:delete')
  async dissolveVariantGroup(
    @Request() req,
    @Param('parentId', ParseIntPipe) parentId: number
  ) {
    return this.service.dissolveVariantGroup(req.user.companyId, parentId);
  }

  // ========================================================
  // 🎯 3. PARAMETERIZED ROUTES (/:id ต้องอยู่ล่างสุด)
  // ========================================================

  @Get(':id')
  @RequirePermissions('product:view')
  findOne(@Param('id', ParseIntPipe) id: number, @Request() req) {
    // 🌟 ดึง userId จาก Token
    const currentUserId = req.user ? (req.user.id || req.user.userId || req.user.sub) : undefined;
    // 🌟 ส่ง currentUserId เข้าไปเป็น Parameter ตัวที่ 3
    return this.service.findOne(id, req.user.companyId, currentUserId);
  }

@Patch(':id')
  @RequirePermissions('product:update')
  @ApiOperation({ summary: 'Update product, variants, and image tags' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProductDto,
    @Request() req,
  ) {
    const companyId = req.user.companyId;
    const userId = req.user.id;

    // 🛡️ ปลอดภัยสูงสุด: ดึง companyId ออกจาก DTO และใช้ค่าจาก Token แทน
    // ใช้ (dto as any) เพื่อเลี่ยง Error TS2339 ตอนสั่งลบ
    const updateData = { ...dto };
    delete (updateData as any).companyId;

    return this.service.update(id, companyId, updateData, userId);
  }

  @Delete(':id')
  @RequirePermissions('product:delete')
  remove(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.service.remove(id, req.user.companyId);
  }

  @Get(':id/price')
  @RequirePermissions('product:view')
  async checkPrice(
    @Param('id', ParseIntPipe) id: number,
    @Query('qty', ParseIntPipe) qty: number,
    @Query('date') dateStr?: string,
  ) {
    const date = dateStr ? new Date(dateStr) : new Date();
    const unitPrice = await this.service.getPriceAtDate(id, qty, date);
    return { productId: id, qty, checkDate: date, unitPrice: unitPrice, totalAmount: Number(unitPrice) * qty };
  }

  @Post(':id/refresh-price')
  @RequirePermissions('product:update')
  async refreshPrice(@Param('id', ParseIntPipe) id: number) {
    await this.service.refreshProductPriceCache(id);
    return { success: true, message: 'Product price cache updated successfully' };
  }

  @Post(':id/tier-prices')
  @RequirePermissions('product:update')
  addTierPrice(@Param('id', ParseIntPipe) productId: number, @Body() dto: CreateProductPriceSetDto, @Request() req) {
    return this.service.addTierPrice(productId, req.user.companyId, dto);
  }

  @Patch(':id/tier-prices/:priceSetId')
  @RequirePermissions('product:update')
  updateTierPriceSet(
    @Param('id', ParseIntPipe) productId: number,
    @Param('priceSetId', ParseIntPipe) priceSetId: number,
    @Body() dto: CreateProductPriceSetDto, 
    @Request() req
  ) {
    return this.service.updateTierPriceSet(productId, priceSetId, req.user.companyId, dto);
  }

  @Delete(':id/tier-prices/:priceSetId') 
  @RequirePermissions('product:delete')
  removeTierPrice(
    @Param('id', ParseIntPipe) productId: number,
    @Param('priceSetId', ParseIntPipe) priceSetId: number,
    @Request() req
  ) {
    return this.service.removeTierPrice(productId, priceSetId, req.user.companyId);
  }

  @Post(':id/images')
  @RequirePermissions('product:update')
  addImage(@Param('id', ParseIntPipe) productId: number, @Body() dto: ProductImageDto, @Request() req) {
    return this.service.addImage(productId, req.user.companyId, dto);
  }

  @Delete(':id/images/:imageId')
  @RequirePermissions('product:delete')
  removeImage(
    @Param('id', ParseIntPipe) productId: number,
    @Param('imageId', ParseIntPipe) imageId: number,
    @Request() req
  ) {
    return this.service.removeImage(productId, imageId, req.user.companyId);
  }

  @Patch('images/:imageId/tags')
  @RequirePermissions('product:update')
  async updateSingleImageTags(
    @Param('imageId', ParseIntPipe) imageId: number,
    @Body('tags') tags: string[],
    @Request() req
  ) {
    return this.service.updateSingleImageTags(req.user.companyId, imageId, tags);
  }

  @Patch('images/gallery/:imageId')
  @RequirePermissions('product:update')
  async updateImageMetadata(
    @Param('imageId', ParseIntPipe) imageId: number,
    @Body() dto: { displayName?: string, tags?: string[] },
    @Request() req
  ) {
    return this.service.updateImageMetadata(req.user.companyId, imageId, dto);
  }
}