import { IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Body for `POST /api/chat/:login` (REST message send — fallback for when
 * WS is unavailable). Also used as the WS `chat:send` payload.
 */
export class SendMessageDto {
  /** The receiver's login (username). Must be an accepted friend. */
  @IsString()
  @MinLength(1)
  receiverLogin!: string;

  /** Message content. 1-1000 chars. Rendered with React escaping (no HTML). */
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  content!: string;
}
