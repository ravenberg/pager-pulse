import {
  type MiddlewareConsumer,
  Module,
  type NestModule,
} from '@nestjs/common';
import { MvcModule } from 'nestjs-mvc';
import { AlertsModule } from './alerts/alerts.module.js';
import { AuthModule } from './auth/auth.module.js';
import { DashboardController } from './dashboard/dashboard.controller.js';
import { DatabaseModule } from './database/database.module.js';
import type { User } from './database/entities/index.js';
import { IncidentsModule } from './incidents/incidents.module.js';
import { InsightsModule } from './insights/insights.module.js';
import { OnCallModule } from './oncall/oncall.module.js';
import { PostMortemsModule } from './post-mortems/post-mortems.module.js';
import { SharedDataMiddleware } from './shared-data.middleware.js';
import { appUrl } from './common/app-url.js';
import { MailModule } from './mail/mail.module.js';
import { StatusModule } from './status/status.module.js';
import { template } from './template.js';
import { XrayModule } from './xray/xray.module.js';

/**
 * What nestjs-mvc signs with: flash cookies, signed URLs. APP_KEY in
 * production; a fixed key in development, so a restart of `nest start
 * --watch` does not break the links in emails already sent.
 */
function signingKeys() {
  if (process.env.APP_KEY || process.env.NODE_ENV === 'production')
    return undefined; // nestjs-mvc reads APP_KEY, and insists on it in production.
  return 'pager-pulse-development-only-signing-key';
}

@Module({
  imports: [
    DatabaseModule,
    MailModule,
    StatusModule,
    AuthModule,
    IncidentsModule,
    AlertsModule,
    PostMortemsModule,
    InsightsModule,
    OnCallModule,
    MvcModule.forRoot({
      template,
      keys: signingKeys(),
      // Signed URLs come out absolute, as links in emails must be.
      url: appUrl(),
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
    // After MvcModule: its interceptor has to see props before they resolve.
    XrayModule,
  ],
  controllers: [DashboardController],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(SharedDataMiddleware).forRoutes('{*path}');
  }
}
