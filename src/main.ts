import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'node:path';
import { AppModule } from './app.module.js';
import { configureApp } from './app.setup.js';

const app = configureApp(
  await NestFactory.create<NestExpressApplication>(AppModule),
);
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
  app.useStaticAssets(join(process.cwd(), 'dist/client'), {
    prefix: '/build/',
  });
}
await app.listen(process.env.PORT ?? 3000);
