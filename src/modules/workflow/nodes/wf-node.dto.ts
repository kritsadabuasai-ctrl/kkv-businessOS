import { IsString, IsInt, IsOptional, IsEnum, Min, IsObject, IsBoolean } from 'class-validator';

// Enum สำหรับกติกาการโหวต
export enum VoteRule {
  ANY_APPROVE = 'ANY_APPROVE',
  ALL_MUST_APPROVE = 'ALL_MUST_APPROVE',
  CUSTOM_PERCENTAGE = 'CUSTOM_PERCENTAGE',
}

// Enum สำหรับสิ่งที่ต้องทำเมื่อหมดเวลา (Timeout / SLA)
export enum TimeoutAction {
  AUTO_APPROVE = 'AUTO_APPROVE',
  AUTO_REJECT = 'AUTO_REJECT',
}

// Enum สำหรับประเภทของโหนด
export enum WfNodeType {
  APPROVAL = 'APPROVAL',
  FYI = 'FYI',
  CONDITION = 'CONDITION',
}

export class CreateWfNodeDto {
  @IsInt()
  workflowId!: number;

  @IsString()
  nodeName!: string; 

  @IsInt()
  stepOrder!: number;

  @IsOptional()
  @IsEnum(WfNodeType)
  nodeType?: WfNodeType; // Default: APPROVAL

  @IsOptional()
  @IsObject()
  conditionLogic?: Record<string, any>;

  // 🌟 [เพิ่มใหม่] บังคับแนบลายเซ็นดิจิทัล
  @IsOptional()
  @IsBoolean()
  requireSignature?: boolean; 


  
  // -- ใครเป็นคนอนุมัติ --
  @IsOptional()
  @IsInt()
  approverRoleId?: number;

  @IsOptional()
  @IsInt()
  approverPositionId?: number;

  @IsOptional()
  @IsString()
  dynamicApprover?: string;

  @IsOptional()
  @IsInt()
  voteThreshold?: number; // สำหรับกติกา CUSTOM_PERCENTAGE

  // -- กติกาการโหวต --
  @IsOptional()
  @IsEnum(VoteRule)
  voteRule?: VoteRule; // Default: ANY_APPROVE

  // -- การตั้งค่า Timeout (SLA) --
  @IsOptional()
  @IsInt()
  @Min(1)
  timeoutHours?: number; 

  @IsOptional()
  @IsEnum(TimeoutAction)
  timeoutAction?: TimeoutAction; 

  // 🌟 [เพิ่มใหม่] สำหรับยิงข้อมูลไป Module อื่นตอนผ่านโหนดนี้
  @IsOptional()
  @IsString()
  webhookUrl?: string;

  @IsOptional()
  @IsObject()
  webhookPayload?: Record<string, any>;
}

export class UpdateWfNodeDto {
  @IsOptional()
  @IsString()
  nodeName?: string;

  @IsOptional()
  @IsInt()
  stepOrder?: number;

  @IsOptional()
  @IsEnum(WfNodeType)
  nodeType?: WfNodeType;

  @IsOptional()
  @IsObject()
  conditionLogic?: Record<string, any>;

  // 🌟 [เพิ่มใหม่] บังคับแนบลายเซ็นดิจิทัล
  @IsOptional()
  @IsBoolean()
  requireSignature?: boolean;

  @IsOptional()
  @IsInt()
  approverRoleId?: number;

  @IsOptional()
  @IsInt()
  approverPositionId?: number;

  @IsOptional()
  @IsString()
  dynamicApprover?: string;

  @IsOptional()
  @IsInt()
  voteThreshold?: number;

  @IsOptional()
  @IsEnum(VoteRule)
  voteRule?: VoteRule;

  @IsOptional()
  @IsInt()
  @Min(1)
  timeoutHours?: number;

  @IsOptional()
  @IsEnum(TimeoutAction)
  timeoutAction?: TimeoutAction;

  // 🌟 [เพิ่มใหม่]
  @IsOptional()
  @IsString()
  webhookUrl?: string;

  @IsOptional()
  @IsObject()
  webhookPayload?: Record<string, any>;

  @IsOptional()
  @IsInt()
  nextApproveId?: number;

  @IsOptional()
  @IsInt()
  nextRejectId?: number;
}