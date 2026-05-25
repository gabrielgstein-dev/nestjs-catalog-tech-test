import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty({ example: 'Electronics', maxLength: 200 })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @ApiPropertyOptional({
    description: 'Parent category id (UUID). Must exist; cannot be the category itself.',
    nullable: true,
    example: null,
  })
  @IsOptional()
  @IsUUID()
  parentId?: string | null;
}
