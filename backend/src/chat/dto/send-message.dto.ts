import { IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Body for `POST /api/chat/:login` (REST message send — fallback for when
 * WS is unavailable). The receiver comes from the URL param, so the body
 * only carries the content. Must be a real class (not a mapped type) so
 * the global ValidationPipe actually runs on it.
 */
export class SendMessageBodyDto {
  /** Message content. 1-1000 chars. Rendered with React escaping (no HTML). */
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  content!: string;
}

/** WS `chat:send` payload shape: body + the receiver's login. */
export class SendMessageDto extends SendMessageBodyDto {
  /** The receiver's login (username). Must be an accepted friend. */
  @IsString()
  @MinLength(1)
  receiverLogin!: string;
}
