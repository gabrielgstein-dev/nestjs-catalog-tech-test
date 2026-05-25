import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateAttributeDto {
  @ApiProperty({ example: 'blue', maxLength: 500 })
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  value!: string;
}
