import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Param, 
  Delete, 
  Query, 
  UseGuards, 
  Request, 
  ParseIntPipe, 
  UseInterceptors, 
  UploadedFile,
  InternalServerErrorException
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { KnowledgeBaseService } from './knowledge-base.service';
import { JwtAuthGuard } from '../../sec/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../sec/auth/permissions.guard'; 
import { SubscriptionGuard } from '../../sec/auth/subscription.guard';
import { RequirePermissions } from '../../sec/auth/permissions.decorator';
import { CreateKnowledgeDto } from './knowledge-base.dto';

@UseGuards(JwtAuthGuard, PermissionsGuard,SubscriptionGuard) 
@Controller('int/knowledge-base') 
export class KnowledgeBaseController {
  constructor(private readonly service: KnowledgeBaseService) {}

  @Get()
  @RequirePermissions('int:knowledge-base:view')
  findAll(
    @Request() req, 
    @Query('search') search?: string,
    @Query('companyId') queryCompanyId?: string // 🌟 เปิดรับค่าจาก Dropdown
  ) {
    const targetCompanyId = queryCompanyId ? parseInt(queryCompanyId) : req.user.companyId;
    return this.service.findAll(targetCompanyId, search);
  }

  @Post('text')
  @RequirePermissions('int:knowledge-base:create')
  createText(
    @Request() req, 
    @Body() dto: CreateKnowledgeDto,
    @Query('companyId') queryCompanyId?: string // 🌟 เปิดรับค่าจาก Dropdown
  ) {
    const targetCompanyId = queryCompanyId ? parseInt(queryCompanyId) : req.user.companyId;
    return this.service.createFromText(targetCompanyId, dto);
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  @RequirePermissions('int:knowledge-base:create')
  async uploadFile(
    @Request() req,
    @UploadedFile() file: Express.Multer.File,
    @Body('topic') topic?: string,
    @Body('processInQueue') processInQueueStr?: string,
    @Query('companyId') queryCompanyId?: string // 🌟 เปิดรับค่าจาก Dropdown
  ) {
    if (!file) throw new InternalServerErrorException('No file provided');

    if (file.originalname) {
      file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');
    }

    const targetCompanyId = queryCompanyId ? parseInt(queryCompanyId) : req.user.companyId;
    const processInQueue = processInQueueStr === 'true';

    if (processInQueue) {
      return this.service.createFromFileQueue(targetCompanyId, file, topic);
    } else {
      return this.service.createFromFile(targetCompanyId, file, topic);
    }
  }

  @Post('google-drive')
  @RequirePermissions('int:knowledge-base:create')
  async createFromDrive(
    @Request() req, 
    @Body() dto: CreateKnowledgeDto,
    @Body('processInQueue') processInQueue?: boolean,
    @Query('companyId') queryCompanyId?: string // 🌟 เปิดรับค่าจาก Dropdown
  ) {
    try {
      const targetCompanyId = queryCompanyId ? parseInt(queryCompanyId) : req.user.companyId;
      if (processInQueue) {
        return await this.service.createFromDriveQueue(targetCompanyId, dto);
      } else {
        return await this.service.createFromDrive(targetCompanyId, dto);
      }
    } catch (error : any) {
      console.error('Create Drive Error:', error);
      throw new InternalServerErrorException(error.message || 'Failed to save Google Drive file');
    }
  }

  @Post('web')
  @RequirePermissions('int:knowledge-base:create')
  async createFromWeb(
    @Request() req, 
    @Body() dto: CreateKnowledgeDto,
    @Body('processInQueue') processInQueue?: boolean,
    @Query('companyId') queryCompanyId?: string // 🌟 เปิดรับค่าจาก Dropdown
  ) {
    try {
      const targetCompanyId = queryCompanyId ? parseInt(queryCompanyId) : req.user.companyId;
      if (processInQueue) {
        return await this.service.createFromWebQueue(targetCompanyId, dto);
      } else {
        return await this.service.createFromWeb(targetCompanyId, dto);
      }
    } catch (error : any) {
      console.error('Create Web Error:', error);
      throw new InternalServerErrorException(error.message || 'Failed to scrape web content');
    }
  }

  @Delete(':id')
  @RequirePermissions('int:knowledge-base:delete')
  remove(
    @Request() req, 
    @Param('id', ParseIntPipe) id: number,
    @Query('companyId') queryCompanyId?: string // 🌟 เปิดรับค่าจาก Dropdown
  ) {
    const targetCompanyId = queryCompanyId ? parseInt(queryCompanyId) : req.user.companyId;
    return this.service.remove(id, targetCompanyId);
  }
}