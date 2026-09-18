export type Severity = 'critical' | 'major' | 'minor';
export type IncidentStatus =
  'investigating' | 'identified' | 'monitoring' | 'resolved';
export type Role = 'admin' | 'responder' | 'viewer';

export interface Person {
  id: number;
  name: string;
}

export interface IncidentRow {
  id: number;
  reference: string;
  title: string;
  severity: Severity;
  status: IncidentStatus;
  isPrivate: boolean;
  lead: Person | null;
  services: string[];
  declaredAt: string;
  resolvedAt: string | null;
}

export interface FollowUpRow {
  id: number;
  title: string;
  assignee: Person | null;
  completedAt: string | null;
  incident: { id: number; reference: string; title: string } | null;
}

/** Props every page gets: `auth` from MvcModule, the rest from SharedDataMiddleware. */
export interface SharedProps {
  auth: {
    user: { id: number; name: string; email: string; role: Role } | null;
  };
  openIncidents?: number;
  /** Null for guests. */
  openAlerts?: number | null;
  [key: string]: unknown;
}

export type AlertStatus = 'firing' | 'acknowledged' | 'resolved';

export interface AlertRow {
  id: number;
  title: string;
  description: string;
  severity: Severity;
  status: AlertStatus;
  source: { id: number; name: string };
  occurrences: number;
  labels: Record<string, string>;
  incident: { id: number; reference: string } | null;
  acknowledgedBy: Person | null;
  firstSeenAt: string;
  lastSeenAt: string;
  resolvedAt: string | null;
}
