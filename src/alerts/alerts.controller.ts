import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Req,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  type AnyRequest,
  View,
  ViewService,
  deepMerge,
  optional,
  prepend,
  requestOrigin,
} from 'nestjs-mvc';
import { Repository } from 'typeorm';
import { z } from 'zod';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Responder, Roles } from '../auth/roles.decorator.js';
import {
  Alert,
  AlertSource,
  EscalationPath,
  Service,
  User,
} from '../database/entities/index.js';
import { reference } from '../incidents/serializers.js';
import { SourceSchema } from './alerts.schemas.js';
import { AlertsService, newToken } from './alerts.service.js';
import { alertRow } from './serializers.js';

/** Sent by the inbox's poll: when it last heard from us. */
const SINCE_HEADER = 'x-alerts-since';

@Controller('alerts')
export class AlertsController {
  constructor(
    private readonly alerts: AlertsService,
    private readonly view: ViewService,
    @InjectRepository(Alert) private readonly repository: Repository<Alert>,
    @InjectRepository(AlertSource)
    private readonly sources: Repository<AlertSource>,
    @InjectRepository(Service) private readonly services: Repository<Service>,
    @InjectRepository(EscalationPath)
    private readonly paths: Repository<EscalationPath>,
  ) {}

  /**
   * The inbox, newest first. A full visit gets the latest 50. The poll sends
   * the cursor it got last time and gets only the difference, in two props:
   *
   * - `alerts`, with `prepend()`: alerts that arrived since, put on top of the
   *   list the page has (`matchOn: 'id'` drops one it already got).
   * - `changes`, with `deepMerge()`: alerts that changed since, keyed by id.
   *   The client keeps merging them into one map and shows the latest copy
   *   of each alert where it already is, so rows never jump under the mouse.
   */
  @Get()
  @View('Alerts/Index')
  index(
    @Headers(SINCE_HEADER) sinceHeader: string | undefined,
    @CurrentUser() user: User,
  ) {
    const now = new Date();
    const since = sinceHeader ? new Date(sinceHeader) : null;
    const valid = since && !Number.isNaN(since.getTime());
    // A second of overlap: SQLite keeps whole seconds; repeats are harmless.
    const after = valid ? new Date(since.getTime() - 1000) : null;
    return {
      cursor: now.toISOString(),
      counts: () => this.alerts.counts(),
      alerts: prepend(
        async () => (await this.alerts.newest(after)).map(alertRow),
        { matchOn: 'id' },
      ),
      changes: deepMerge(async () =>
        after
          ? Object.fromEntries(
              (await this.alerts.changedSince(after)).map((alert) => [
                alert.id,
                alertRow(alert),
              ]),
            )
          : {},
      ),
      // For the escalate dialog, when it opens.
      escalationPaths: optional(async () =>
        (await this.paths.find({ order: { name: 'ASC' } })).map(
          ({ id, name }) => ({ id, name }),
        ),
      ),
      canRespond: user.role !== 'viewer',
      canManage: user.role === 'admin',
    };
  }

  @Post(':id/acknowledge')
  @Responder()
  async acknowledge(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: User,
  ) {
    await this.alerts.acknowledge(await this.alerts.find(id), user);
    return this.view.back();
  }

  @Post(':id/resolve')
  @Responder()
  async resolve(@Param('id', ParseIntPipe) id: number) {
    await this.alerts.resolve(await this.alerts.find(id));
    return this.view.back();
  }

  @Post(':id/declare')
  @Responder()
  async declare(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: User,
  ) {
    const alert = await this.alerts.find(id);
    if (alert.incident)
      return this.view
        .flash('error', `This alert already has ${reference(alert.incident)}.`)
        .redirect(`/incidents/${alert.incident.id}`);
    const incident = await this.alerts.declare(alert, user);
    return this.view
      .flash('success', `${reference(incident)} declared from the alert.`)
      .redirect(`/incidents/${incident.id}`);
  }

  /** Where tools are connected. Tokens are secrets, so admins only. */
  @Get('sources')
  @Roles('admin')
  @View('Alerts/Sources')
  async sourcesPage(@Req() req: AnyRequest) {
    const sources = await this.sources.find({
      relations: { service: true },
      order: { createdAt: 'ASC' },
    });
    const stats = await this.repository
      .createQueryBuilder('alert')
      .select('alert.sourceId', 'sourceId')
      .addSelect('COUNT(*)', 'total')
      .addSelect('MAX(alert.lastSeenAt)', 'lastSeenAt')
      .groupBy('alert.sourceId')
      .getRawMany<{ sourceId: number; total: number; lastSeenAt: string }>();
    const bySource = new Map(stats.map((row) => [row.sourceId, row]));

    return {
      ingestUrl: `${requestOrigin(req) ?? ''}/alerts/ingest`,
      sources: sources.map((source) => {
        const row = bySource.get(source.id);
        return {
          id: source.id,
          name: source.name,
          token: source.token,
          service: source.service?.name ?? null,
          alerts: Number(row?.total ?? 0),
          // SQLite hands back its own UTC format; make it an ISO instant.
          lastAlertAt: row?.lastSeenAt
            ? new Date(`${row.lastSeenAt.replace(' ', 'T')}Z`).toISOString()
            : null,
        };
      }),
      services: (await this.services.find({ order: { position: 'ASC' } })).map(
        (service) => ({ id: service.id, name: service.name }),
      ),
    };
  }

  @Post('sources')
  @Roles('admin')
  async createSource(
    @Body({ schema: SourceSchema }) body: z.infer<typeof SourceSchema>,
  ) {
    await this.sources.save(
      this.sources.create({
        name: body.name,
        token: newToken(),
        service: body.serviceId
          ? await this.services.findOneBy({ id: body.serviceId })
          : null,
      }),
    );
    return this.view
      .flash('success', `Source “${body.name}” created. Copy its token below.`)
      .back();
  }

  @Post('sources/:id/rotate')
  @Roles('admin')
  async rotate(@Param('id', ParseIntPipe) id: number) {
    const source = await this.source(id);
    await this.sources.update(id, { token: newToken() });
    return this.view
      .flash(
        'success',
        `New token for “${source.name}”. The old one no longer works.`,
      )
      .back();
  }

  @Delete('sources/:id')
  @Roles('admin')
  async destroySource(@Param('id', ParseIntPipe) id: number) {
    const source = await this.source(id);
    await this.sources.remove(source);
    return this.view
      .flash('success', `Source “${source.name}” and its alerts deleted.`)
      .back();
  }

  private async source(id: number) {
    const source = await this.sources.findOneBy({ id });
    if (!source) throw new NotFoundException('That source no longer exists.');
    return source;
  }
}
