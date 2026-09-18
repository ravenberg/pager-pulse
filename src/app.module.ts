import {
  type MiddlewareConsumer,
  Module,
  type NestModule,
} from '@nestjs/common';
import { MvcModule } from 'nestjs-mvc';
import { AuthModule } from './auth/auth.module.js';
import { DashboardController } from './dashboard/dashboard.controller.js';
import { DatabaseModule } from './database/database.module.js';
import type { User } from './database/entities/index.js';
import { IncidentsModule } from './incidents/incidents.module.js';
import { OnCallModule } from './oncall/oncall.module.js';
import { SharedDataMiddleware } from './shared-data.middleware.js';
import { StatusController } from './status/status.controller.js';
import { template } from './template.js';

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    IncidentsModule,
    OnCallModule,
    MvcModule.forRoot({
      template,
      version: process.env.GIT_COMMIT,
      // Vite runs inside this process in development; production resolves the
      // hashed assets from the build manifest.
      vite: {},
      // The logged-in user on every page as `auth.user`: only these fields.
      auth: {
        share: (user: User) => ({
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        }),
      },
      errorPages: ({ status, exception }) =>
        [403, 404, 500, 503].includes(status)
          ? {
              component: 'Errors/Show',
              props: { status, reason: (exception as Error).message },
              shared: true,
            }
          : undefined,
    }),
  ],
  controllers: [DashboardController, StatusController],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(SharedDataMiddleware).forRoutes('{*path}');
  }
}
