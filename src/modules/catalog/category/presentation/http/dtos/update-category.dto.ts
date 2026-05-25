import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength, MinLength, ValidateIf } from 'class-validator';

export class UpdateCategoryDto {
  @ApiPropertyOptional({ example: 'Electronics & Gadgets', maxLength: 200 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({
    description: 'New parent id (UUID) or null to clear the parent. Omit to keep current parent.',
    nullable: true,
  })
  @ValidateIf((o: UpdateCategoryDto, value) => value !== null)
  @IsOptional()
  @IsUUID()
  parentId?: string | null;
}
