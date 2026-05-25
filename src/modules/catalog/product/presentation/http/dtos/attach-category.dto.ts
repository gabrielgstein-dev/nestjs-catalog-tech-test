import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class AttachCategoryDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  categoryId!: string;
}
