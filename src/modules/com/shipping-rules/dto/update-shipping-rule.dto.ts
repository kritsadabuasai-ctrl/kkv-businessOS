import { PartialType } from '@nestjs/mapped-types';
import { CreateShippingRuleDto } from './create-shipping-rule.dto';

export class UpdateShippingRuleDto extends PartialType(CreateShippingRuleDto) {}