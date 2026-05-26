import { Controller, Post, Body } from '@nestjs/common';
import { LandingRegistrationService } from './landing-registration.service';
import { LandingRegistrationDto } from './landing-registration.dto';

@Controller('public/registration') // URL: /api/public/registration
export class LandingRegistrationController {
  constructor(private readonly service: LandingRegistrationService) {}

  @Post()
  register(@Body() dto: LandingRegistrationDto) {
    return this.service.registerInterest(dto);
  }
}