import { StandardSchemaValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { standardSchemaExceptionFactory } from 'nestjs-mvc';
import { join } from 'node:path';
import { AppModule } from './app.module.js';

const app = await NestFactory.create<NestExpressApplication>(AppModule);
app.useGlobalPipes(
  new StandardSchemaValidationPipe({
    exceptionFactory: standardSchemaExceptionFactory,
  }),
);
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
  app.useStaticAssets(join(process.cwd(), 'dist/client'), {
    prefix: '/build/',
  });
}
await app.listen(process.env.PORT ?? 3000);
