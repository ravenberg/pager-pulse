import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'node:crypto';
import { MoreThan, Not, Repository } from 'typeorm';
import {
  Alert,
  AlertSource,
  type Incident,
  User,
} from '../database/entities/index.js';
import { IncidentsService } from '../incidents/incidents.service.js';
import type { IngestPayload } from './alerts.schemas.js';

export type IngestOutcome = 'created' | 'deduplicated' | 'resolved' | 'ignored';

export const newToken = () => `pp_${randomBytes(18).toString('base64url')}`;

@Injectable()
export class AlertsService {
  constructor(
    private readonly incidents: IncidentsService,
    @InjectRepository(Alert) private readonly alerts: Repository<Alert>,
    @InjectRepository(AlertSource)
    private readonly sources: Repository<AlertSource>,
  ) {}

  sourceByToken(token: string) {
    return this.sources.findOne({
      where: { token },
      relations: { service: true },
    });
  }

  async find(id: number): Promise<Alert> {
    const alert = await this.alerts.findOne({
      where: { id },
      relations: {
        source: { service: true },
        incident: true,
        acknowledgedBy: true,
      },
    });
    if (!alert) throw new NotFoundException('That alert no longer exists.');
    return alert;
  }

  /** The newest alerts, or with `since` only those that arrived after it. */
  newest(since: Date | null, take = 50) {
    return this.alerts.find({
      where: since ? { firstSeenAt: MoreThan(since) } : {},
      relations: { source: true, incident: true, acknowledgedBy: true },
      order: { firstSeenAt: 'DESC', id: 'DESC' },
      take,
    });
  }

  /** Alerts that changed after `since`: fired again, acknowledged, resolved. */
  changedSince(since: Date) {
    return this.alerts.find({
      where: { updatedAt: MoreThan(since) },
      relations: { source: true, incident: true, acknowledgedBy: true },
      take: 200,
    });
  }

  countOpen() {
    return this.alerts.countBy({ status: Not('resolved') });
  }

  async counts() {
    const [firing, acknowledged, resolved] = await Promise.all([
      this.alerts.countBy({ status: 'firing' }),
      this.alerts.countBy({ status: 'acknowledged' }),
      this.alerts.countBy({
        status: 'resolved',
        resolvedAt: MoreThan(new Date(Date.now() - 24 * 60 * 60 * 1000)),
      }),
    ]);
    return { firing, acknowledged, resolved };
  }

  /**
   * A firing alert with the key of one that is still open is another
   * occurrence of it; a resolve closes the open one. A resolve for an alert
   * we never saw open is ignored.
   */
  async ingest(
    source: AlertSource,
    payload: IngestPayload,
  ): Promise<{ alert: Alert | null; outcome: IngestOutcome }> {
    const open = payload.dedupKey
      ? await this.alerts.findOne({
          where: {
            source: { id: source.id },
            dedupKey: payload.dedupKey,
            status: Not('resolved'),
          },
        })
      : null;
    const now = new Date();

    if (payload.status === 'resolved') {
      if (!open) return { alert: null, outcome: 'ignored' };
      open.status = 'resolved';
      open.resolvedAt = now;
      return { alert: await this.alerts.save(open), outcome: 'resolved' };
    }

    if (open) {
      open.occurrences += 1;
      open.lastSeenAt = now;
      open.title = payload.title;
      if (payload.description) open.description = payload.description;
      return { alert: await this.alerts.save(open), outcome: 'deduplicated' };
    }

    const alert = await this.alerts.save(
      this.alerts.create({
        source,
        title: payload.title,
        description: payload.description,
        severity: payload.severity,
        dedupKey: payload.dedupKey ?? null,
        labels: payload.labels,
        lastSeenAt: now,
      }),
    );
    return { alert, outcome: 'created' };
  }

  async acknowledge(alert: Alert, user: User) {
    if (alert.status !== 'firing') return;
    await this.alerts.update(alert.id, {
      status: 'acknowledged',
      acknowledgedBy: user,
    });
  }

  async resolve(alert: Alert) {
    if (alert.status === 'resolved') return;
    await this.alerts.update(alert.id, {
      status: 'resolved',
      resolvedAt: new Date(),
    });
  }

  /** Declares an incident from the alert and acknowledges the alert on it. */
  async declare(alert: Alert, user: User): Promise<Incident> {
    const incident = await this.incidents.declare(
      {
        title: alert.title,
        summary: alert.description,
        severity: alert.severity,
        serviceIds: alert.source.service ? [alert.source.service.id] : [],
        leadId: user.id,
        isPublic: alert.severity !== 'minor',
      },
      user,
    );
    await this.incidents.postUpdate(
      incident,
      user,
      `Declared from the ${alert.source.name} alert “${alert.title}”.`,
      false,
    );
    await this.alerts.update(alert.id, {
      incident,
      status: alert.status === 'firing' ? 'acknowledged' : alert.status,
      acknowledgedBy: alert.acknowledgedBy ?? user,
    });
    return incident;
  }
}
