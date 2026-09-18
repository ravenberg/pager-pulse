import {
  type MiddlewareConsumer,
  Module,
  type NestModule,
} from '@nestjs/common';
import { MvcModule } from 'nestjs-mvc';
import { AlertsModule } from './alerts/alerts.module.js';
import { AccountModule } from './account/account.module.js';
import { AuthModule } from './auth/auth.module.js';
import { CatalogModule } from './catalog/catalog.module.js';
import { SearchModule } from './search/search.module.js';
import { DashboardModule } from './dashboard/dashboard.module.js';
import { DatabaseModule } from './database/database.module.js';
import type { User } from './database/entities/index.js';
import { IncidentsModule } from './incidents/incidents.module.js';
import { OnCallModule } from './oncall/oncall.module.js';
import { PeopleModule } from './people/people.module.js';
import { PostMortemsModule } from './post-mortems/post-mortems.module.js';
import { SharedDataMiddleware } from './shared-data.middleware.js';
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
    StatusModule,
    AuthModule,
    IncidentsModule,
    AlertsModule,
    PostMortemsModule,
    DashboardModule,
    CatalogModule,
    SearchModule,
    OnCallModule,
    AccountModule,
    PeopleModule,
    MvcModule.forRoot({
      template,
      keys: signingKeys(),
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
              props: {
                status,
                // Ours to show for a 403 or 404; a 500's message is internal.
                reason: status < 500 ? (exception as Error).message : undefined,
              },
              shared: true,
            }
          : undefined,
    }),
    // After MvcModule: its interceptor has to see props before they resolve.
    XrayModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(SharedDataMiddleware).forRoutes('{*path}');
  }
}
