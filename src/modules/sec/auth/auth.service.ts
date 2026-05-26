import { Injectable, UnauthorizedException, ConflictException, NotFoundException, Logger ,InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { LoginDto, RegisterDto } from './auth.dto';
//import { CompanyType } from '@prisma/client';
import axios from 'axios';
import { MailService } from '../../int/mail/mail.service'; // 🌟 1. นำเข้า MailService
import { BadRequestException } from '@nestjs/common'; // 🌟 นำเข้า Exception เพิ่มเติม
//import { OnboardingService } from '../../org/onboarding/onboarding.service'; // ตรวจสอบ Path ให้ตรงกับโครงสร้างจริง


@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private mailService: MailService,
   // private onboardingService: OnboardingService,
  ) {}

 // =========================================================
  // 1. ตรวจสอบ User สำหรับ Login (พร้อมระบบป้องกัน Brute-force และเก็บ Audit Log)
  // =========================================================
  async validateUser(
    loginDto: LoginDto, 
    ipAddress?: string, 
    userAgent?: string
  ): Promise<any> {
    const user = await this.prisma.secUser.findUnique({
      where: { username: loginDto.username },
    });

    if (!user) {
      // 🚨 กรณีไม่พบ Username ในระบบ: ยังคงใช้ LogAudit เพราะไม่มี userId ให้บันทึกลง SecLoginLog
      this.prisma.logAudit.create({
        data: {
          companyId: loginDto.companyId || 0, 
          userId: null, 
          tableName: 'SecUser',
          action: 'LOGIN_FAILED',
          recordId: 'UNKNOWN_USER',
          ipAddress: ipAddress || null,
          userAgent: userAgent || null,
          newValues: { reason: 'User not found', attemptedUsername: loginDto.username }
        }
      }).catch(() => {});

      throw new UnauthorizedException('ไม่พบชื่อผู้ใช้งานนี้ในระบบ');
    }

    if (user.isLocked && user.lockoutExpires) {
      if (user.lockoutExpires > new Date()) {
        const remainingTime = Math.ceil((user.lockoutExpires.getTime() - new Date().getTime()) / 60000);
        
        // 🚨 บันทึก Log กรณีพยายาม Login ตอนบัญชีโดนระงับ (SecLoginLog)
        this.prisma.secLoginLog.create({
          data: {
            companyId: loginDto.companyId || 0,
            userId: user.id,
            ipAddress: ipAddress || null,
            userAgent: userAgent || null,
            status: 'FAILED',
            failureReason: `Account is locked (${remainingTime} mins remaining)`
          }
        }).catch(() => {});

        throw new UnauthorizedException(`บัญชีถูกระงับชั่วคราว กรุณาลองใหม่ในอีก ${remainingTime} นาที`);
      } else {
        user.isLocked = false;
        user.loginAttempts = 0;
        user.lockoutExpires = null;
      }
    }

    const isPasswordValid = user.passwordHash && (await bcrypt.compare(loginDto.password, user.passwordHash));

    if (isPasswordValid) {
      if (user.loginAttempts > 0 || user.isLocked) {
        await this.prisma.secUser.update({
          where: { id: user.id },
          data: { 
            loginAttempts: 0, 
            isLocked: false, 
            lockoutExpires: null 
          }
        });
      }
      const { passwordHash, ...result } = user;
      return result; 
    } else {
      const policy = await this.prisma.secPasswordPolicy.findFirst({
        where: { companyId: null }
      }) || await this.prisma.secPasswordPolicy.findFirst();

      const maxAttempts = policy?.maxLoginAttempts || 5; 
      const lockoutMins = policy?.lockoutDuration || 30; 

      const newAttempts = (user.loginAttempts || 0) + 1;
      const updateData: any = { loginAttempts: newAttempts };

      if (newAttempts >= maxAttempts) {
        const lockoutDate = new Date();
        lockoutDate.setMinutes(lockoutDate.getMinutes() + lockoutMins);
        
        updateData.isLocked = true;
        updateData.lockoutExpires = lockoutDate;
        
        await this.prisma.secUser.update({
          where: { id: user.id },
          data: updateData
        });
        
        // 🚨 บันทึก Log กรณีกดรหัสผิดจนโดนบล็อคบัญชี (SecLoginLog)
        this.prisma.secLoginLog.create({
          data: {
            companyId: loginDto.companyId || 0,
            userId: user.id,
            ipAddress: ipAddress || null,
            userAgent: userAgent || null,
            status: 'FAILED',
            failureReason: `Max attempts reached (Locked for ${lockoutMins} mins)`
          }
        }).catch(() => {});

        throw new UnauthorizedException(`คุณใส่รหัสผิดเกิน ${maxAttempts} ครั้ง บัญชีถูกระงับ ${lockoutMins} นาที`);
      }

      await this.prisma.secUser.update({
        where: { id: user.id },
        data: updateData
      });

      // 🚨 บันทึก Log กรณีกดรหัสผิด แต่ยังมีโอกาสแก้ตัว (SecLoginLog)
      this.prisma.secLoginLog.create({
        data: {
          companyId: loginDto.companyId || 0,
          userId: user.id,
          ipAddress: ipAddress || null,
          userAgent: userAgent || null,
          status: 'FAILED',
          failureReason: `Invalid Password (Attempt ${newAttempts})`
        }
      }).catch(() => {});

      throw new UnauthorizedException(`รหัสผ่านไม่ถูกต้อง (เหลือโอกาสอีก ${maxAttempts - newAttempts} ครั้ง)`);
    }
  }

  // =========================================================
  // 2. ออก Token พร้อมบริบทของบริษัท และ บันทึก Audit Log
  // =========================================================
 async login(user: any, companyId?: number, ipAddress?: string, userAgent?: string) {
    const userRoles = await this.prisma.secUserRole.findMany({
      where: { userId: user.id },
      include: { role: true }
    });
    
    const isSuperAdmin = userRoles.some(ur => ur.role?.name?.toUpperCase() === 'SUPER_ADMIN');
    
    let targetCompanyId = companyId;
    if (!targetCompanyId && userRoles.length > 0) {
      targetCompanyId = userRoles[0].companyId;
    }

    const payload = { 
      username: user.username, 
      sub: user.id, 
      userId: user.id,
      companyId: targetCompanyId,
      isSuperAdmin 
    };

    // 🌟 บันทึกประวัติการ Login เข้าสู่ระบบ "สำเร็จ" ลงตาราง SecLoginLog
    if (targetCompanyId) {
      this.prisma.secLoginLog.create({
        data: {
          companyId: targetCompanyId,
          userId: user.id,
          ipAddress: ipAddress || null,
          userAgent: userAgent || null,
          status: 'SUCCESS',
          failureReason: null // 🟢 ไม่มีเหตุผลการล้มเหลว
        }
      }).catch(err => this.logger.error(`Login Audit Error: ${err.message}`));
    }

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        isSuperAdmin,
        companyId: targetCompanyId
      }
    };
  }

  // =========================================================
  // 🚪 ฟังก์ชันสำหรับการ Logout (บันทึก Audit Log)
  // =========================================================
  async logout(userId: number, companyId: number, ipAddress?: string, userAgent?: string) {
    if (companyId && userId) {
      // 🌟 บันทึกประวัติการ Logout ลงตาราง SecLoginLog
      await this.prisma.secLoginLog.create({
        data: {
          companyId: companyId,
          userId: userId,
          ipAddress: ipAddress || null,
          userAgent: userAgent || null,
          status: 'LOGOUT', // 🟢 ใช้ status เพื่อบอกว่านี่คือเหตุการณ์ออกจากระบบ
          failureReason: null
        }
      }).catch(err => this.logger.error(`Logout Audit Error: ${err.message}`));
    }

    return { message: 'ออกจากระบบสำเร็จ' };
  }

// =========================================================
  // 2. ฟังก์ชันสมัครสมาชิก (เวอร์ชันดั้งเดิม: สร้างเฉพาะ User)
  // =========================================================
  async register(dto: RegisterDto): Promise<any> {
    // 1. ตรวจสอบว่ามีผู้ใช้งานหรืออีเมลนี้อยู่แล้วหรือไม่
    const existingUser = await this.prisma.secUser.findFirst({
      where: {
        OR: [
          { username: dto.username },
          { email: dto.email },
        ],
      },
    });

    if (existingUser) {
      throw new ConflictException('ชื่อผู้ใช้งานหรืออีเมลนี้มีอยู่ในระบบแล้ว');
    }

    // 2. เข้ารหัสผ่าน
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    // 3. บันทึกข้อมูลผู้ใช้งานใหม่
    const newUser = await this.prisma.secUser.create({
      data: {
        username: dto.username,
        email: dto.email,
        fullName: `${dto.firstName} ${dto.lastName}`, // รวมชื่อและนามสกุล [cite: 195]
        passwordHash: hashedPassword,
        isActive: true,
      },
    });

    // ส่งคืนข้อมูลโดยไม่ส่งรหัสผ่านกลับไป
    const { passwordHash, ...result } = newUser;
    return result;
  }

  // =========================================================
  // 8. ลืมรหัสผ่าน (Forgot Password) -> 🌟 เพิ่มฟังก์ชันใหม่
  // =========================================================
  async forgotPassword(email: string) {
    const user = await this.prisma.secUser.findFirst({
      where: { email },
      include: { roles: true } 
    });

    // 🛡️ Security: ถ้าหาอีเมลไม่เจอ จะไม่แจ้งเตือนตรงๆ ว่าไม่มี เพื่อป้องกันคนสุ่มสแปมอีเมล
    if (!user) {
      return { message: 'หากอีเมลนี้อยู่ในระบบ เราได้ส่งลิงก์รีเซ็ตรหัสผ่านไปให้ท่านแล้ว' };
    }

    // 💡 ทริค: ใช้ JwtService สร้าง Token หมดอายุใน 15 นาที โดยไม่ต้องแก้ Database!
    const resetToken = this.jwtService.sign(
      { sub: user.id, email: user.email, purpose: 'reset-password' },
      { expiresIn: '15m', secret: process.env.JWT_SECRET || 'fallback-secret-key' } 
    );

    // สร้างลิงก์สำหรับกดเข้าไปเปลี่ยนรหัส
    const resetUrl = `https://kkvservice.com/reset-password?token=${resetToken}`;
    
    // หากำกับบริษัทที่จะใช้ดึง Template และ SMTP
    const targetCompanyId = user.roles.length > 0 ? user.roles[0].companyId : null;

    // 🌟 สั่งส่งอีเมล!
    if (targetCompanyId && user.email) { // 👈 เพิ่มการเช็ค && user.email ตรงนี้ด้วยเพื่อความชัวร์
       await this.mailService.sendEmail({
        to: user.email!, // 👈 เติม ! ตรงนี้เช่นกันครับ
        templateCode: 'RESET_PASSWORD',
        companyId: targetCompanyId,
        variables: {
          name: user.fullName,
          resetUrl: resetUrl
        }
      });
    }

    return { message: 'หากอีเมลนี้อยู่ในระบบ เราได้ส่งลิงก์รีเซ็ตรหัสผ่านไปให้ท่านแล้ว' };
  }

 // =========================================================
  // 9. ตั้งรหัสผ่านใหม่ (Reset Password) -> 🌟 อัปเดตเช็ค Policy
  // =========================================================
  async resetPassword(token: string, newPassword: string) {
    try {
      const decoded = this.jwtService.verify(token, { secret: process.env.JWT_SECRET || 'fallback-secret-key' });
      if (decoded.purpose !== 'reset-password') throw new BadRequestException('Token สิทธิ์ไม่ถูกต้อง');

      // 🌟 1. หา Policy เพื่อตรวจสอบรหัสผ่าน
      const policy = await this.getPasswordPolicyByToken(token);

      // 🌟 2. ตรวจสอบเงื่อนไขตามกฎ Policy ของบริษัท
      if (newPassword.length < policy.minLength) {
        throw new BadRequestException(`รหัสผ่านต้องมีความยาวอย่างน้อย ${policy.minLength} ตัวอักษร`);
      }
      if (policy.requireUpper && !/[A-Z]/.test(newPassword)) {
        throw new BadRequestException('รหัสผ่านต้องมีตัวอักษรภาษาอังกฤษพิมพ์ใหญ่ (A-Z) อย่างน้อย 1 ตัว');
      }
      if (policy.requireLower && !/[a-z]/.test(newPassword)) {
        throw new BadRequestException('รหัสผ่านต้องมีตัวอักษรภาษาอังกฤษพิมพ์เล็ก (a-z) อย่างน้อย 1 ตัว');
      }
      if (policy.requireNumber && !/[0-9]/.test(newPassword)) {
        throw new BadRequestException('รหัสผ่านต้องมีตัวเลข (0-9) อย่างน้อย 1 ตัว');
      }
      if (policy.requireSpecial) {
         // ตรวจสอบอักขระพิเศษตามที่บริษัทกำหนดไว้
         const escapeRegex = (str: string) => str.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
         const specialRegex = new RegExp(`[${escapeRegex(policy.specialChars)}]`);
         if (!specialRegex.test(newPassword)) {
            throw new BadRequestException(`รหัสผ่านต้องมีอักขระพิเศษอย่างน้อย 1 ตัว (เช่น ${policy.specialChars})`);
         }
      }

      // 🌟 3. เงื่อนไขผ่านหมด เข้ารหัสและบันทึก
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await this.prisma.secUser.update({
        where: { id: decoded.sub },
        data: { 
          passwordHash: hashedPassword,
          passwordUpdatedAt: new Date()
        }
      });

      return { message: 'เปลี่ยนรหัสผ่านสำเร็จ สามารถเข้าสู่ระบบด้วยรหัสผ่านใหม่ได้ทันที' };
      
    } catch (error) {
      // แยกระหว่าง Error จากการ Validate รหัสผ่านผิด กับ Error Token หมดอายุ
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException('ลิงก์รีเซ็ตรหัสผ่านหมดอายุหรือไม่ถูกต้อง กรุณากดลืมรหัสผ่านอีกครั้ง');
    }
  }

  // =========================================================
  // 🔍 10. ดึง Password Policy ตาม Token (สำหรับให้หน้าบ้านดึงไปแสดงผล)
  // =========================================================
  async getPasswordPolicyByToken(token: string) {
    try {
      const decoded = this.jwtService.verify(token, { secret: process.env.JWT_SECRET || 'fallback-secret-key' });
      
      const userRole = await this.prisma.secUserRole.findFirst({ where: { userId: decoded.sub } });
      const companyId = userRole?.companyId || null;

      // 🌟 แก้ไขตรงนี้: เติม : any เข้าไปเพื่อให้ TypeScript ยอมรับ Object จาก Database
      let policy: any = null; 
      
      if (companyId) {
        policy = await this.prisma.secPasswordPolicy.findUnique({ where: { companyId } });
      }
      if (!policy) {
        policy = await this.prisma.secPasswordPolicy.findFirst({ where: { companyId: null } });
      }

      // คืนค่า Policy กลับไป (ถ้าไม่มีในระบบเลย ให้ส่งค่า Default ไป)
      return policy || {
        minLength: 8,
        requireUpper: true,
        requireLower: true,
        requireNumber: true,
        requireSpecial: true,
        specialChars: "!@#$%^&*"
      };
    } catch (error) {
      throw new BadRequestException('ลิงก์หมดอายุหรือไม่ถูกต้อง');
    }
  }




  // =========================================================
  // 4. Social Login (พร้อมด่านตรวจ Config + ระบบ Auto-Join)
  // =========================================================
  async loginWithSocial(
    provider: string, 
    token: string, 
    companyId: number, 
    ipAddress?: string,   // 🌟 1. รับค่า IP เพิ่มเข้ามา
    userAgent?: string    // 🌟 2. รับค่า User Agent เพิ่มเข้ามา
  ) {
    const authConfig = await this.prisma.secCompanyAuthConfig.findFirst({
      where: { 
        companyId: companyId,
        providerId: provider.toUpperCase()
      }
    });

    if (authConfig && authConfig.isEnabled === false) {
      throw new UnauthorizedException(`บริษัทนี้ไม่ได้เปิดใช้งานการล็อกอินผ่าน ${provider}`);
    }

    // 🌟 1. FIX: ส่ง authConfig (การตั้งค่าของบริษัทนั้นๆ) ลงไปให้ verifySocialToken ด้วย
    const profile: any = await this.verifySocialToken(provider, token, authConfig);
    
    let whereCondition: any = {};
    const updateData: any = {};

    if (provider === 'line') {
      whereCondition = { lineUserId: profile.id };
      updateData.lineUserId = profile.id;
    } else if (provider === 'google') {
      whereCondition = { googleId: profile.id };
      updateData.googleId = profile.id;
    } else if (provider === 'facebook') {
      whereCondition = { facebookId: profile.id };
      updateData.facebookId = profile.id;
    }

    let user: any = await this.prisma.secUser.findFirst({ where: whereCondition });

    if (!user && profile.email) {
      user = await this.prisma.secUser.findFirst({ where: { email: profile.email } });
      if (user) {
        await this.prisma.secUser.update({
          where: { id: user.id },
          data: updateData
        });
        this.logger.log(`🔗 Auto-linked ${provider} account for user: ${user.email}`);
      }
    }

    if (!user) {
      this.logger.log(`✨ Creating new user from ${provider}: ${profile.name}`);
      const randomPassword = Math.random().toString(36).slice(-10);
      const hashedPassword = await bcrypt.hash(randomPassword, 10);
      const newUsername = profile.email || `${provider}_${profile.id}`;

      user = await this.prisma.secUser.create({
        data: {
          username: newUsername,
          email: profile.email || null,
          fullName: profile.name || 'Unknown User',
          passwordHash: hashedPassword,
          ...updateData,
        }
      });
    }

    const existingRole = await this.prisma.secUserRole.findFirst({
      where: { userId: user.id, companyId: companyId }
    });

    if (!existingRole) {
      this.logger.log(`🔗 Assigning default role for User ${user.id} to Company ${companyId}`);
      
      let defaultRole = await this.prisma.secRole.findFirst({
        where: { companyId: companyId, name: 'USER' } 
      });

      if (!defaultRole) {
        defaultRole = await this.prisma.secRole.create({
          data: { companyId: companyId, name: 'USER', displayName: 'ผู้ใช้งานทั่วไป' }
        });
      }

      await this.prisma.secUserRole.create({
        data: {
          userId: user.id,
          companyId: companyId,
          roleId: defaultRole.id
        }
      });
    }

    return this.login(user, companyId, ipAddress, userAgent);
  }

 // =========================================================
  // 🛍️ ฟังก์ชันสำหรับลูกค้าเข้าสู่ระบบ Marketplace (ผ่าน LINE LIFF)
  // =========================================================
  async loginMemberWithLine(token: string, companyId: number, ipAddress?: string, userAgent?: string) {
    // 1. ตรวจสอบการตั้งค่า (เหมือนเดิม)
    const authConfig = await this.prisma.secCompanyAuthConfig.findFirst({
      where: { companyId: companyId, providerId: 'LINE' }
    });

    const profile: any = await this.verifySocialToken('line', token, authConfig);
    
    if (!profile || !profile.id) {
      throw new UnauthorizedException('ไม่สามารถดึงข้อมูลจาก LINE ได้');
    }

    let member = await this.prisma.crmMember.findFirst({
      where: { companyId: companyId, lineUserId: profile.id }
    });

    if (!member && profile.email) {
      member = await this.prisma.crmMember.findFirst({
        where: { companyId: companyId, email: profile.email }
      });

      if (member) {
        member = await this.prisma.crmMember.update({
          where: { id: member.id },
          data: { 
            lineUserId: profile.id,
            lineName: profile.name,
            linePicture: profile.picture
          }
        });
        this.logger.log(`🔗 รวมบัญชี LINE เข้ากับสมาชิกเดิม (Email: ${profile.email}) เรียบร้อยแล้ว`);
      }
    }

    if (!member) {
      this.logger.log(`✨ สมาชิกลูกค้าใหม่จาก LINE: ${profile.name}`);
      const memberCode = `M-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

      member = await this.prisma.crmMember.create({
        data: {
          companyId: companyId,
          memberCode: memberCode,
          lineUserId: profile.id,
          lineName: profile.name,
          linePicture: profile.picture,
          firstName: profile.name,
          email: profile.email || null,
        }
      });
    } else {
      await this.prisma.crmMember.update({
        where: { id: member.id },
        data: { lineName: profile.name, linePicture: profile.picture }
      });
    }

    const payload = { 
      sub: member.id, 
      memberId: member.id,
      companyId: companyId,
      isMember: true 
    };

    // 🌟 1. เพิ่มโค้ดส่วนนี้ก่อนการ Return 🌟
    // สร้าง Audit Log ว่าลูกค้าคนนี้ล็อกอินสำเร็จ (ใช้ Fire-and-forget เหมือนเดิม)
    this.prisma.logAudit.create({
      data: {
        companyId: companyId,
        userId: null, // ฝั่ง Member ไม่ได้ผูกกับ SecUser เลยตั้งเป็น null ไว้ก่อน หรือจะเพิ่มฟิลด์ memberId ไปใน LogAudit ในอนาคตก็ได้
        tableName: 'CrmMember', // อ้างอิงว่าเป็นรายการเข้าสู่ระบบของลูกค้า
        action: 'MEMBER_LOGIN', // แยก Action ให้ชัดเจน จะได้รู้ว่ามาจากฝั่งหน้าบ้าน
        recordId: String(member.id),
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
      }
    }).catch(err => this.logger.error(`Member Line Login Audit Error: ${err.message}`));
    // 🌟 จบส่วนที่เพิ่ม 🌟

    return {
      access_token: this.jwtService.sign(payload),
      member: {
        id: member.id,
        name: member.firstName,
        picture: member.linePicture,
        companyId: member.companyId
      }
    };
  }

  // 🛠️ Helper: ยิงตรวจสอบ Token กับเซิร์ฟเวอร์ของแต่ละเจ้า
  // 🛠️ Helper: ยิงตรวจสอบ Token กับเซิร์ฟเวอร์ของแต่ละเจ้า
  private async verifySocialToken(provider: string, tokenOrCode: string, authConfig?: any) {
    try {
      if (provider === 'line') {
        const clientId = authConfig?.clientId || process.env.LINE_CHANNEL_ID || '';
        const clientSecret = authConfig?.clientSecret || process.env.LINE_CHANNEL_SECRET || '';

        const payload: Record<string, string> = {
          grant_type: 'authorization_code',
          code: tokenOrCode, 
          redirect_uri: 'https://kkvservice.com/login/callback', 
          client_id: clientId,
          client_secret: clientSecret,
        };
        
        const tokenParams = new URLSearchParams(payload);

        const tokenRes = await axios.post('https://api.line.me/oauth2/v2.1/token', tokenParams.toString(), {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        const accessToken = tokenRes.data.access_token;
        const idToken = tokenRes.data.id_token; // 🌟 รับ id_token มาด้วย

        // 🌟 ถอดรหัส id_token เพื่อเอาอีเมลออกมา (LINE ซ่อนอีเมลไว้ในนี้)
        let email = null;
        if (idToken) {
          try {
            const base64Url = idToken.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = Buffer.from(base64, 'base64').toString('utf-8');
            const decoded = JSON.parse(jsonPayload);
            email = decoded.email || null;
          } catch (e) {
            this.logger.error('ไม่สามารถถอดรหัส Email จาก LINE id_token ได้');
          }
        }

        const profileRes = await axios.get('https://api.line.me/v2/profile', {
          headers: { Authorization: `Bearer ${accessToken}` }
        });

        // 🌟 คืนค่า email ที่ถอดรหัสได้กลับไปด้วย
        return { 
          id: profileRes.data.userId, 
          name: profileRes.data.displayName, 
          email: email 
        }; 
      }
      else if (provider === 'google') {
        const clientId = authConfig?.clientId || process.env.GOOGLE_CLIENT_ID || '';
        const clientSecret = authConfig?.clientSecret || process.env.GOOGLE_CLIENT_SECRET || '';

        const payload: Record<string, string> = {
          grant_type: 'authorization_code',
          code: tokenOrCode,
          redirect_uri: 'https://kkvservice.com/login/callback', 
          client_id: clientId,
          client_secret: clientSecret,
        };

        const tokenParams = new URLSearchParams(payload);

        const tokenRes = await axios.post('https://oauth2.googleapis.com/token', tokenParams.toString(), {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        const accessToken = tokenRes.data.access_token;

        const res = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        
        return { id: res.data.sub, name: res.data.name, email: res.data.email };
      } 
      else if (provider === 'facebook') {
        // 🌟 1. ดึง Key ของ Facebook (รองรับทั้งส่วนกลางและบริษัทย่อย)
        const clientId = authConfig?.clientId || process.env.FACEBOOK_APP_ID || '';
        const clientSecret = authConfig?.clientSecret || process.env.FACEBOOK_APP_SECRET || '';

        // 🌟 2. เอา Auth Code ไปแลกเป็น Access Token จาก Facebook
        const tokenParams = new URLSearchParams({
          client_id: clientId,
          redirect_uri: 'https://kkvservice.com/login/callback',
          client_secret: clientSecret,
          code: tokenOrCode,
        });

        // Facebook ใช้วิธี GET ในการแลก Token
        const tokenRes = await axios.get(`https://graph.facebook.com/v19.0/oauth/access_token?${tokenParams.toString()}`);
        const accessToken = tokenRes.data.access_token;

        // 🌟 3. เอา Access Token ไปดึงข้อมูล Profile
        const res = await axios.get(`https://graph.facebook.com/me?fields=id,name,email&access_token=${accessToken}`);
        
        return { id: res.data.id, name: res.data.name, email: res.data.email };
      }

      throw new UnauthorizedException(`Provider ${provider} is not supported.`);
    } catch (error: any) {
      this.logger.error(`Social Token Verification Failed [${provider}]: ${error.response?.data?.error_description || error.message}`);
      throw new UnauthorizedException(`Invalid token/code for ${provider}`);
    }
  }

  

  // =========================================================
  // 5. ดึงข้อมูล Profile พร้อมสิทธิ์, เมนู และข้อมูลพนักงาน (Employee)
  // =========================================================
  async getProfile(userId: number, companyId: number) {
    const allUserRoles = await this.prisma.secUserRole.findMany({
      where: { userId },
      include: { role: true }
    });

    const isSuperAdmin = allUserRoles.some(ur => ur.role?.name === 'SUPER_ADMIN');

    const user = await this.prisma.secUser.findUnique({
      where: { id: userId },
      include: {
        employee: true, // 🌟 เพิ่มตรงนี้! เพื่อดึงข้อมูลประวัติพนักงาน (ถ้าไม่มีจะเป็น null อัตโนมัติ)
        roles: {
          where: { companyId: companyId },
          include: {
            role: {
              include: {
                menus: {
                  include: { menu: { include: { module: true } } },
                  orderBy: { sortOrder: 'asc' }
                },
                permissions: { include: { permission: true } }
              }
            }
          }
        }
      }
    });

    if (!user) throw new NotFoundException('User not found');

    let permissionIds: number[] = [];

    if (isSuperAdmin) {
      const allPermissions = await this.prisma.secPermission.findMany({ select: { id: true } });
      permissionIds = allPermissions.map(p => p.id);
    } else {
      permissionIds = user.roles.flatMap(ur => 
        ur.role.permissions.map(rp => rp.permissionId)
      );
    }

    return {
      ...user,
      isSuperAdmin, 
      currentPermissionIds: permissionIds 
    };
  }

  // =========================================================
  // 6. ฟังก์ชันสลับบริษัท
  // =========================================================
  async switchCompany(
    userId: number, 
    companyId: number, 
    ipAddress?: string,   // 🌟 1. รับค่า IP
    userAgent?: string    // 🌟 2. รับค่า User Agent
  ) {
    const user = await this.prisma.secUser.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException();
    
    const userRoles = await this.prisma.secUserRole.findMany({ where: { userId }, include: { role: true } });
    const isSuperAdmin = userRoles.some(ur => ur.role?.name?.toUpperCase() === 'SUPER_ADMIN');
    const hasAccess = userRoles.some(ur => ur.companyId === companyId);

    if (!isSuperAdmin && !hasAccess) {
      throw new UnauthorizedException('คุณไม่มีสิทธิ์เข้าถึงบริษัทนี้');
    }

    // 🌟 3. ส่ง ipAddress และ userAgent ต่อไปให้ this.login เพื่อบันทึก Audit Log 
    return this.login(user, companyId, ipAddress, userAgent);
  }

  // =========================================================
  // 7. ดึงข้อมูลบริษัทเบื้องต้นสำหรับหน้า Login (Public)
  // =========================================================
  async getPublicCompanyInfo(companyId: number) {
    const company = await this.prisma.orgCompany.findUnique({
      where: { id: companyId },
      // ✅ 1. เพิ่มให้ดึง logoUrl มาด้วย (ถ้าใน DB คุณกฤษฎาตั้งชื่อว่า logo เฉยๆ ก็แก้ตรงนี้ได้เลยครับ)
      select: { name: true, logoUrl: true } 
    });

    if (!company) throw new NotFoundException('Company not found');

    return {
      name: company.name,
      slogan: 'ระบบจัดการร้านค้า', 
      // ✅ 2. เอา URL จากฐานข้อมูลส่งไปให้หน้าเว็บ
      logoUrl: company.logoUrl || null 
    };
  }

  // =========================================================
  // 📧 8. ขอรหัส OTP (Email-based)
  // =========================================================
async requestOtp(email: string, companyId?: number, shopId?: number, purpose: string = 'LOGIN') {
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    // 1. บันทึก OTP
    await this.prisma.secOtp.create({
      data: {
        email,
        companyId,
        shopId,
        code: otpCode,
        purpose: purpose, // 🌟 เปลี่ยนจาก 'LOGIN' เฉยๆ เป็นตัวแปร purpose
        expiresAt
      }
    });

    // 2. ค้นหาชื่อร้านค้าเพื่อทำ Branding
    let shopName = 'ระบบ KKV';
    if (shopId) {
      const shop = await this.prisma.comShopProfile.findUnique({ where: { id: shopId } });
      if (shop) shopName = shop.shopName;
    }

    // 3. ส่งอีเมลในนามของร้านค้านั้นๆ
    const subject = `รหัส OTP สำหรับเข้าสู่ระบบ ${shopName}`;
    const text = `รหัส OTP ของคุณคือ: ${otpCode} (รหัสนี้มีอายุการใช้งาน 5 นาที)`;
    
    await this.mailService.sendEmail({
        to: email,
        subject: subject,
        html: text // หรือเปลี่ยนเป็น text: text (ขึ้นอยู่กับว่าระบบรับคำว่าอะไร)
    });
    return { message: 'ส่ง OTP เรียบร้อย' };
  }

 // =========================================================
  // 📧 9. ยืนยันรหัส OTP (ลอจิก Auto-Link: Login or Register)
  // =========================================================
async verifyOtp(
    email: string, 
    otp: string, 
    companyId?: number, 
    shopId?: number, 
    purpose: string = 'LOGIN',
    ipAddress?: string,   // 🌟 1. รับค่า IP เพิ่มเข้ามา
    userAgent?: string    // 🌟 2. รับค่า User Agent เพิ่มเข้ามา
  ) {
    const targetCompanyId = companyId ? Number(companyId) : 0;
    const targetShopId = shopId ? Number(shopId) : 0;

    // 1. ตรวจสอบความถูกต้องของ OTP
    const otpRecord = await this.prisma.secOtp.findFirst({
      where: {
        email: email,
        code: otp,
        purpose: purpose, // 🌟 เพิ่มบรรทัดนี้ เพื่อให้เช็ค purpose ด้วย
        companyId: targetCompanyId > 0 ? targetCompanyId : null,
        shopId: targetShopId > 0 ? targetShopId : null,
        isUsed: false,
        expiresAt: { gt: new Date() }
      },
      orderBy: { createdAt: 'desc' }
    });

    if (!otpRecord) {
      throw new BadRequestException('รหัส OTP ไม่ถูกต้องหรือหมดอายุแล้ว');
    }

    // 2. ทำเครื่องหมายว่าใช้งานแล้ว
    await this.prisma.secOtp.update({
      where: { id: otpRecord.id },
      data: { isUsed: true }
    });

    // 3. ตรวจสอบว่ามี User ในระบบภายใต้ Company นี้หรือยัง
    let user = await this.prisma.secUser.findFirst({
      where: { email: email },
      include: { roles: true }
    });

    // 🌟 [ทางเลือกที่ 1: Auto-Link Logic]
    if (!user) {
      // 🆕 กรณีไม่พบ User: ทำการ "สมัครสมาชิกใหม่" ให้อัตโนมัติ
      user = await this.prisma.$transaction(async (tx) => {
        // 3.1 สร้างบัญชีผู้ใช้งาน (SecUser)
        const newUser = await tx.secUser.create({
          data: {
            username: email, 
            email: email,
            fullName: email.split('@')[0], 
            isActive: true,
          }
        });

        // 3.2 สร้างข้อมูลสมาชิก (CrmMember) ผูกกับ Company
        if (targetCompanyId > 0) {
          await tx.crmMember.create({
            data: {
              companyId: targetCompanyId,
              memberCode: `M-${Date.now()}`,
              email: email,
              firstName: email.split('@')[0],
              isActive: true,
            }
          });

          // 3.3 มอบหมายบทบาทพื้นฐาน (Role) เช่น CUSTOMER
          const customerRole = await tx.secRole.findFirst({
            where: { companyId: targetCompanyId, name: 'CUSTOMER' }
          });

          if (customerRole) {
            await tx.secUserRole.create({
              data: {
                userId: newUser.id,
                roleId: customerRole.id,
                companyId: targetCompanyId
              }
            });
          }
        }

        return tx.secUser.findUnique({ 
          where: { id: newUser.id }, 
          include: { roles: true } 
        });
      });

      // 🌟 [เพิ่มจุดนี้] เพื่อบอก TypeScript ว่า user จะไม่มีทางเป็น null เด็ดขาด
      if (!user) {
        throw new InternalServerErrorException('เกิดข้อผิดพลาดในการสร้างบัญชีผู้ใช้งาน');
      }

      this.logger.log(`👤 สร้างบัญชีใหม่สำหรับอีเมล ${email} เรียบร้อยแล้ว`);
    } else {
      this.logger.log(`🔑 ผู้ใช้งาน ${email} เข้าสู่ระบบด้วย OTP (Existing User)`);
    }

    // 4. ตรวจสอบ Company ID ที่จะใช้ในการออก Token
    const finalCompanyId = targetCompanyId > 0 
      ? targetCompanyId 
      : (user.roles && user.roles.length > 0 ? user.roles[0].companyId : 0);

    // 5. ส่งกลับข้อมูล accessToken และ userData
    return this.login(user, finalCompanyId, ipAddress, userAgent);
  }

}