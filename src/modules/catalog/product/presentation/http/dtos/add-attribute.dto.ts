import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class AddAttributeDto {
  @ApiProperty({ example: 'color', maxLength: 100 })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  key!: string;

  @ApiProperty({ example: 'red', maxLength: 500 })
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  value!: string;
}
