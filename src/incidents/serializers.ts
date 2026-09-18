import type {
  FollowUp,
  Incident,
  TimelineEntry,
  User,
} from '../database/entities/index.js';

/** What pages see of a user: never the whole entity. */
export const person = (user: User | null | undefined) =>
  user ? { id: user.id, name: user.name } : null;

export const reference = (incident: Pick<Incident, 'id'>) =>
  `INC-${incident.id}`;

export function incidentRow(incident: Incident) {
  return {
    id: incident.id,
    reference: reference(incident),
    title: incident.title,
    severity: incident.severity,
    status: incident.status,
    lead: person(incident.lead),
    services: (incident.services ?? []).map((service) => service.name),
    declaredAt: incident.declaredAt.toISOString(),
    resolvedAt: incident.resolvedAt?.toISOString() ?? null,
  };
}

export function timelineEntry(entry: TimelineEntry) {
  return {
    id: entry.id,
    kind: entry.kind,
    body: entry.body,
    isPublic: entry.isPublic,
    author: person(entry.author),
    createdAt: entry.createdAt.toISOString(),
  };
}

export function followUp(item: FollowUp) {
  return {
    id: item.id,
    title: item.title,
    assignee: person(item.assignee),
    completedAt: item.completedAt?.toISOString() ?? null,
    incident: item.incident
      ? {
          id: item.incident.id,
          reference: reference(item.incident),
          title: item.incident.title,
        }
      : null,
  };
}
