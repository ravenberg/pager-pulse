import {
  type INestApplication,
  StandardSchemaValidationPipe,
} from '@nestjs/common';
import { standardSchemaExceptionFactory } from 'nestjs-mvc';

/** What main.ts and the end-to-end tests both need: field errors back to the forms. */
export function configureApp<T extends INestApplication>(app: T): T {
  app.useGlobalPipes(
    new StandardSchemaValidationPipe({
      exceptionFactory: standardSchemaExceptionFactory,
    }),
  );
  return app;
}
