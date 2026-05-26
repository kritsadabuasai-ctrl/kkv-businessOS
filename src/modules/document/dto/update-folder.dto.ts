import { PartialType } from '@nestjs/mapped-types';
// หรือถ้าใช้ Swagger ให้ import จาก '@nestjs/swagger' แทนครับ
import { CreateFolderDto } from './create-folder.dto';

export class UpdateFolderDto extends PartialType(CreateFolderDto) {}