import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import { CopilotService } from './copilot.service';
import { AskCopilotDto } from './copilot.dto';

import { JwtAuthGuard } from '../../sec/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../sec/auth/permissions.guard';
import { RequirePermissions } from '../../sec/auth/permissions.decorator';
import { SubscriptionGuard } from '../../sec/auth/subscription.guard';

@Controller('int/copilot')
@UseGuards(JwtAuthGuard, PermissionsGuard, SubscriptionGuard)
export class CopilotController {
  constructor(private readonly copilotService: CopilotService) {}

  @Post('ask')
  @RequirePermissions('document:view') // 🛡️ ต้องมีสิทธิ์อ่านเอกสารองค์กรถึงจะใช้ AI ตัวนี้ได้
  async askQuestion(
    @Req() req: any,
    @Body() dto: AskCopilotDto
  ) {
    const companyId = req.user.companyId;
    // สมมติว่าใน Token มี roles array มาด้วย (เช่น req.user.roles = [1, 3])
    const userRoleIds = req.user.roles?.map(r => r.roleId) || []; 

    return this.copilotService.askAiWithRbac(companyId, userRoleIds, dto.question);
  }
}