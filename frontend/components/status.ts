export type ServiceStatus =
  'operational' | 'degraded' | 'partial_outage' | 'major_outage';

export const SERVICE_STATUS: Record<
  ServiceStatus,
  { label: string; color: string; headline: string }
> = {
  operational: {
    label: 'Operational',
    color: 'green',
    headline: 'All systems operational',
  },
  degraded: {
    label: 'Degraded performance',
    color: 'yellow',
    headline: 'Some systems are degraded',
  },
  partial_outage: {
    label: 'Partial outage',
    color: 'orange',
    headline: 'We are having a partial outage',
  },
  major_outage: {
    label: 'Full outage',
    color: 'red',
    headline: 'We are having a major outage',
  },
};

export interface PublicIncident {
  id: number;
  reference: string;
  title: string;
  status: 'investigating' | 'identified' | 'monitoring' | 'resolved';
  impact: ServiceStatus;
  services: string[];
  declaredAt: string;
  resolvedAt: string | null;
  updates: { id: number; body: string; createdAt: string }[];
}
