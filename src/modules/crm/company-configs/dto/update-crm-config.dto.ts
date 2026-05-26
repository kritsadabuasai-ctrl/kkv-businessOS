import { PartialType } from '@nestjs/mapped-types';
import { CreateCrmConfigDto } from './create-crm-config.dto';

export class UpdateCrmConfigDto extends PartialType(CreateCrmConfigDto) {}