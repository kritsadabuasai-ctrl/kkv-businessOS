import { IsInt, IsNotEmpty } from 'class-validator';

export class AddPackageModuleDto {
  @IsInt()
  @IsNotEmpty()
  packageId!: number;

  @IsInt()
  @IsNotEmpty()
  moduleId!: number;
}