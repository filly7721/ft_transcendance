import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';

/**
 * Translates known Prisma client errors into the appropriate HTTP status, so
 * feature services don't have to wrap every DB call in a try/catch for the
 * common cases.
 *
 *   P2002 (unique-constraint violation) -> 409 Conflict
 *   P2025 (record not found)            -> 404 Not Found
 *
 * Everything else is left to Nest's default exception handling (500 with no
 * leaked internals) — that is the correct default; never catch-and-swallow.
 *
 * Registered globally in `main.ts` via `app.useGlobalFilters()`.
 */
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter
  implements ExceptionFilter<Prisma.PrismaClientKnownRequestError>
{
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(
    exception: Prisma.PrismaClientKnownRequestError,
    host: ArgumentsHost,
  ): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'database error';

    switch (exception.code) {
      case 'P2002':
        status = HttpStatus.CONFLICT;
        message = 'a record with this value already exists';
        break;
      case 'P2025':
        status = HttpStatus.NOT_FOUND;
        message = 'record not found';
        break;
    }

    this.logger.warn(
      `Prisma ${exception.code} -> HTTP ${status}: ${exception.message}`,
    );

    response.status(status).json({
      statusCode: status,
      message,
      error: HttpStatus[status],
    });
  }
}
