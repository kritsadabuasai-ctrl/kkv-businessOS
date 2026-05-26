import { IsString, IsInt, IsOptional, IsBoolean, IsNotEmpty } from 'class-validator';

export class CreateWfModuleMappingDto {
  @IsString()
  @IsNotEmpty({ message: 'กรุณาระบุรหัสโมดูล (Module Code)' })
  moduleCode!: string; // 👈 เติม ! ตรงนี้

  @IsInt()
  @IsNotEmpty({ message: 'กรุณาระบุรหัสสายอนุมัติ (Workflow ID)' })
  workflowId!: number; // 👈 เติม ! ตรงนี้

  @IsString()
  @IsOptional()
  condition?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateWfModuleMappingDto {
  @IsString()
  @IsOptional()
  moduleCode?: string;

  @IsInt()
  @IsOptional()
  workflowId?: number;

  @IsString()
  @IsOptional()
  condition?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}