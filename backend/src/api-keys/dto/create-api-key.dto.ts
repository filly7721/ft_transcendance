import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, Matches } from 'class-validator';

/** Body of `POST /api/keys` — the label the owner will recognize the key by. */
export class CreateApiKeyDto {
  @ApiProperty({
    description: 'Human-readable label so you can tell your keys apart.',
    example: 'tournament bot',
    minLength: 1,
    maxLength: 40,
  })
  @IsString()
  @Length(1, 40)
  // Printable, non-exotic label: letters, digits, spaces and - _ . only.
  // Keeps a key name from smuggling control characters into logs and lists.
  @Matches(/^[\w .-]+$/, {
    message: 'name may only contain letters, digits, spaces, dots, - and _',
  })
  name!: string;
}
