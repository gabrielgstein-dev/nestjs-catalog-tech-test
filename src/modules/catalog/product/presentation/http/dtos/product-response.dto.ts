import { ApiProperty } from '@nestjs/swagger';
import { ProductStatus } from '../../../domain/value-objects/product-status';

export class ProductAttributeDto {
  @ApiProperty()
  key!: string;

  @ApiProperty()
  value!: string;
}

export class ProductResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ nullable: true })
  description!: string | null;

  @ApiProperty({ enum: ProductStatus })
  status!: ProductStatus;

  @ApiProperty({ type: [String], description: 'IDs of attached categories' })
  categoryIds!: string[];

  @ApiProperty({ type: [ProductAttributeDto] })
  attributes!: ProductAttributeDto[];
}
