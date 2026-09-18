import type { Alert } from '../database/entities/index.js';
import { person, reference } from '../incidents/serializers.js';

export function alertRow(alert: Alert) {
  return {
    id: alert.id,
    title: alert.title,
    description: alert.description,
    severity: alert.severity,
    status: alert.status,
    source: { id: alert.source.id, name: alert.source.name },
    occurrences: alert.occurrences,
    labels: alert.labels,
    incident: alert.incident
      ? { id: alert.incident.id, reference: reference(alert.incident) }
      : null,
    acknowledgedBy: person(alert.acknowledgedBy),
    firstSeenAt: alert.firstSeenAt.toISOString(),
    lastSeenAt: alert.lastSeenAt.toISOString(),
    resolvedAt: alert.resolvedAt?.toISOString() ?? null,
  };
}
