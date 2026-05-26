import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../../prisma/prisma.service'; // ✅ 1. ใช้ Service กลาง
import { WfActionService } from '../actions/wf-action.service'; // ✅ 2. เรียก Action Service
import { ActionType } from '../actions/wf-action.dto';

@Injectable()
export class WorkflowSchedulerService {
  private readonly logger = new Logger(WorkflowSchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly actionService: WfActionService // ✅ Inject ActionService
  ) {}

 @Cron(CronExpression.EVERY_HOUR)
  async handleTimeoutRequests() {
    this.logger.debug('⏰ Checking for expired workflow requests...');

    const pendingRequests = await this.prisma.wfRequest.findMany({
      where: {
        status: 'IN_PROGRESS',
        currentNode: { timeoutHours: { not: null } } 
      },
      include: { currentNode: true }
    });

    const now = new Date();

    for (const req of pendingRequests) {
      const node = req.currentNode;
      if (!node || !node.timeoutHours) continue;

      const lastUpdate = new Date(req.updatedAt);
      const expireTime = new Date(lastUpdate.getTime() + (node.timeoutHours * 60 * 60 * 1000));

      if (now > expireTime) {
        const timeoutAction = node.timeoutAction;
        
        try {
          // 🌟 ใช้ ID ของผู้ขออนุมัติเป็นตัวแทน (Bypass ผ่าน validateApprover ด้วย Comment)
          const systemUserId = req.requesterId; 
          const comment = `🤖 System Auto-Action: Timeout after ${node.timeoutHours} hours.`;

          let actionType: ActionType | null = null;
          if (timeoutAction === 'AUTO_APPROVE') actionType = ActionType.APPROVE;
          if (timeoutAction === 'AUTO_REJECT') actionType = ActionType.REJECT;

          if (actionType) {
            await this.actionService.create(req.companyId, systemUserId, {
              requestId: req.id,
              action: actionType,
              comment: comment
            });
          }
        } catch (error : any) {
          this.logger.error(`❌ Failed to process timeout for Request #${req.id}: ${error.message}`);
        }
      }
    }
  }
}