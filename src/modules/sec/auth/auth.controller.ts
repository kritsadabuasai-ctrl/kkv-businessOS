import { 
  Controller, Post, Get, Body, UnauthorizedException, 
  UseGuards, Request, Param, ParseIntPipe, HttpCode, HttpStatus ,Ip, Headers
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto, SocialLoginDto, ForgotPasswordDto, ResetPasswordDto, RequestOtpDto, VerifyOtpDto } from './auth.dto';
import { Public } from './public.decorator';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Post('login')
  async login(
    @Body() loginDto: LoginDto,
    @Ip() ip: string, 
    @Headers('user-agent') userAgent: string 
  ) {
    // 🌟 ส่ง ip และ userAgent เข้าไปให้หน่วยสืบสวนใน validateUser
    const user = await this.authService.validateUser(loginDto, ip, userAgent);
    
    if (!user) throw new UnauthorizedException('Invalid credentials');
    
    return this.authService.login(user, loginDto.companyId, ip, userAgent);
  }

  // ==========================================
  // 🚪 API สำหรับ Logout (บันทึกประวัติการออกจากระบบ)
  // ==========================================
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Request() req,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string
  ) {
    const userId = Number(req.user.userId || req.user.sub);
    const companyId = Number(req.user.companyId ?? 0);
    
    // ส่งข้อมูลไปบันทึก Log ใน Service
    return this.authService.logout(userId, companyId, ip, userAgent);
  }

  @Public()
  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Public()
  @Get('company-info/:cid')
  async getPublicCompanyInfo(@Param('cid', ParseIntPipe) cid: number) {
    return this.authService.getPublicCompanyInfo(cid);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  async getProfile(@Request() req) {
    const userId = Number(req.user.userId || req.user.sub);
    const companyId = Number(req.user.companyId ?? 0);
    
    // ดึง Profile จาก Database
    const profile = await this.authService.getProfile(userId, companyId);

    // ยัดเยียดความเป็น Super Admin จาก Token ลงไปใน Response เสมอ
    return {
      ...profile,
      isSuperAdmin: req.user.isSuperAdmin 
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('switch-company/:companyId')
  async switchCompany(
    @Request() req,
    @Param('companyId', ParseIntPipe) companyId: number,
    @Ip() ip: string, // 🌟 1. รับค่า IP
    @Headers('user-agent') userAgent: string // 🌟 2. รับค่า Browser/Device
  ) {
    const userId = Number(req.user.userId || req.user.sub);
    
    // 🌟 3. ส่งต่อไปให้ Service
    return this.authService.switchCompany(userId, companyId, ip, userAgent);
  }

  // ==========================================
  // 🚪 ประตู 1: สำหรับพนักงานเข้าหลังบ้าน (CMS/Admin)
  // ==========================================
  @Public()
  @Post('line-login')
  async lineLogin(
    @Body() dto: SocialLoginDto,
    @Ip() ip: string, // 🌟 1. รับค่า IP
    @Headers('user-agent') userAgent: string // 🌟 2. รับค่า Browser
  ) {
    // 🌟 3. ส่งต่อไปให้ Service
    return this.authService.loginWithSocial('line', dto.token, dto.companyId ?? 0, ip, userAgent);
  }

  @Public()
  @Post('google-login')
  async googleLogin(
    @Body() dto: SocialLoginDto,
    @Ip() ip: string, // 🌟 1. รับค่า IP
    @Headers('user-agent') userAgent: string // 🌟 2. รับค่า Browser
  ) {
    // 🌟 3. ส่งต่อไปให้ Service
    return this.authService.loginWithSocial('google', dto.token, dto.companyId ?? 0, ip, userAgent);
  }

  // ==========================================
  // 🚪 ประตู 2: สำหรับลูกค้าเข้าซื้อของ (Marketplace/LIFF)
  // ==========================================
  @Public()
  @Post('member/line-login')
  async memberLineLogin(
    @Body() dto: SocialLoginDto,
    @Ip() ip: string, // 🌟 รับ IP Address
    @Headers('user-agent') userAgent: string // 🌟 รับข้อมูล Browser/OS
  ) {
    // 🌟 ส่งค่า ip และ userAgent ไปให้ Service
    return this.authService.loginMemberWithLine(dto.token, dto.companyId ?? 0, ip, userAgent);
  }

  // =========================================================
  // 📧 3. API สำหรับขอลืมรหัสผ่าน (ส่งอีเมล)
  // =========================================================
  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  // =========================================================
  // 🔑 4. API สำหรับตั้งรหัสผ่านใหม่ (ใช้ Token จากอีเมล)
  // =========================================================
  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.newPassword);
  }

 @Public()
  @Post('request-otp')
  @HttpCode(HttpStatus.OK)
  async requestOtp(@Body() dto: RequestOtpDto) {
    // 🌟 เพิ่ม dto.purpose เป็น Parameter ที่ 4
    return this.authService.requestOtp(dto.email, dto.companyId, dto.shopId, dto.purpose);
  }

  @Public()
  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  async verifyOtp(
    @Body() dto: VerifyOtpDto,
    @Ip() ip: string, // 🌟 1. รับค่า IP
    @Headers('user-agent') userAgent: string // 🌟 2. รับค่า Browser/Device
  ) {
    // 🌟 3. ส่งต่อไปให้ Service เป็นพารามิเตอร์ตัวที่ 6 และ 7
    return this.authService.verifyOtp(
      dto.email, 
      dto.code, 
      dto.companyId, 
      dto.shopId, 
      dto.purpose, 
      ip, 
      userAgent
    );
  }
}