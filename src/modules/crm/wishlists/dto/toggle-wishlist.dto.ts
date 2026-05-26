import { IsInt, IsNotEmpty } from 'class-validator';

export class ToggleWishlistDto {
  @IsInt()
  @IsNotEmpty()
  productId: number;
}