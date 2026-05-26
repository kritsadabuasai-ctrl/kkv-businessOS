import { Module } from '@nestjs/common';
import { PackageModulesService } from './package-modules.service';
import { PackageModulesController } from './package-modules.controller';
import { PrismaModule } from '../../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [PackageModulesController],
  providers: [PackageModulesService],
  exports: [PackageModulesService],
})
export class PackageModulesModule {}