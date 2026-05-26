import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Patch, 
  Param, 
  Delete, 
  UseGuards, 
  Request, 
  ParseIntPipe
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiOkResponse, ApiCreatedResponse } from '@nestjs/swagger';
import { CartService } from './cart.service';
import { CreateCartDto, UpdateCartDto, MergeCartDto } from './dto/create-cart.dto';

// 🌟 Import Guard สำหรับตรวจการล็อกอิน
import { JwtAuthGuard } from '../../sec/auth/jwt-auth.guard'; 

@ApiTags('Commerce: Cart (ตะกร้าสินค้า)')
@ApiBearerAuth() // 🌟 เปิดให้ Swagger มีปุ่มใส่ Token
@UseGuards(JwtAuthGuard) // 🌟 บังคับว่าต้อง Login เท่านั้น ห้ามมี Guard สิทธิ์พนักงานมาปนตรงนี้
@Controller('com/carts')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Post()
  @ApiOperation({ summary: 'เพิ่มสินค้าลงตะกร้า' })
  @ApiCreatedResponse({ description: 'เพิ่มสินค้าลงตะกร้าสำเร็จ พร้อมคำนวณราคาปัจจุบัน' })
  addToCart(@Request() req, @Body() createCartDto: CreateCartDto) {
    const memberId = req.user.id; // 🌟 ลบ || 1 ทิ้ง ใช้ข้อมูลจริงจาก Token
    return this.cartService.addToCart(memberId, createCartDto);
  }

  @Post('merge')
  @ApiOperation({ summary: 'ซิงค์ตะกร้าจาก LocalStorage (ใช้ตอน Login สำเร็จ)' })
  @ApiOkResponse({ description: 'นำข้อมูลจาก LocalStorage เทลง Database สำเร็จ' })
  mergeCart(@Request() req, @Body() mergeCartDto: MergeCartDto) {
    const memberId = req.user.id; // 🌟 ลบ || 1 ทิ้ง
    return this.cartService.mergeCart(memberId, mergeCartDto);
  }

  @Get()
  @ApiOperation({ summary: 'ดึงข้อมูลตะกร้าสินค้าของฉัน' })
  @ApiOkResponse({ description: 'คืนค่ารายการตะกร้าสินค้า โดยจัดกลุ่มแยกตามหน้าร้าน (Shop)' })
  getMyCart(@Request() req) {
    const memberId = req.user.id; // 🌟 ลบ || 1 ทิ้ง
    return this.cartService.getMyCart(memberId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'อัปเดตจำนวนสินค้าในตะกร้า' })
  @ApiOkResponse({ description: 'อัปเดตจำนวนสำเร็จ พร้อมคำนวณราคาส่งใหม่ (ถ้ามี)' })
  updateQuantity(
    @Request() req, 
    @Param('id', ParseIntPipe) id: number, 
    @Body() updateCartDto: UpdateCartDto
  ) {
    const memberId = req.user.id; // 🌟 ลบ || 1 ทิ้ง
    return this.cartService.updateQuantity(memberId, id, updateCartDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'ลบสินค้าออกจากตะกร้า' })
  @ApiOkResponse({ description: 'ลบรายการในตะกร้าสำเร็จ' })
  removeFromCart(
    @Request() req, 
    @Param('id', ParseIntPipe) id: number
  ) {
    const memberId = req.user.id; // 🌟 ลบ || 1 ทิ้ง
    return this.cartService.removeFromCart(memberId, id);
  }
}