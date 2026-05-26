import { 
  Controller, 
  Post, 
  Body, 
  Request, 
  UseGuards 
} from '@nestjs/common';
import { WorkflowSimulationService, SimulationStep } from './workflow-simulation.service';
import { JwtAuthGuard } from '../../sec/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../sec/auth/permissions.guard';
import { RequirePermissions } from '../../sec/auth/permissions.decorator';
import { SubscriptionGuard } from '../../sec/auth/subscription.guard';

@Controller('workflow/simulation')
@UseGuards(JwtAuthGuard, SubscriptionGuard, PermissionsGuard)
export class WorkflowSimulationController {
  constructor(private readonly simulationService: WorkflowSimulationService) {}

  @Post()
  @RequirePermissions('workflow_request:view')
  async simulate(
    @Request() req,
    @Body() body: { 
      workflowId: number; 
      requesterId?: number; 
      mockPayload?: any; // 🌟 รับ Payload เพื่อเอาไปคำนวณ Condition
    }
  ): Promise<{ workflowName: string; requesterId: number; path: SimulationStep[] }> {
    const companyId = req.user.companyId;
    
    // ถ้าหน้าบ้านไม่ได้เลือกพนักงานมา (requesterId) ให้ใช้ userId ของคนที่กด Simulate
    const targetRequesterId = body.requesterId ? Number(body.requesterId) : req.user.userId;

    return this.simulationService.simulatePath(
      companyId,
      targetRequesterId,
      body.workflowId,
      body.mockPayload || {}
    );
  }
}