import {
  type MiddlewareConsumer,
  Module,
  type NestModule,
} from '@nestjs/common';
import { APP_INTERCEPTOR, DiscoveryModule } from '@nestjs/core';
import { XrayPrecognitionMiddleware } from './xray-precognition.middleware.js';
import { XrayController } from './xray.controller.js';
import { XrayInterceptor } from './xray.interceptor.js';
import { XrayService } from './xray.service.js';

/**
 * The opt-in overlay that shows which nestjs-mvc features a page uses.
 * Import it after MvcModule, so its interceptor runs inside MvcInterceptor.
 */
@Module({
  imports: [DiscoveryModule],
  controllers: [XrayController],
  providers: [
    XrayService,
    { provide: APP_INTERCEPTOR, useClass: XrayInterceptor },
  ],
})
export class XrayModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(XrayPrecognitionMiddleware).forRoutes('{*path}');
  }
}
