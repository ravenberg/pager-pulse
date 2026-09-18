import { Badge, type BadgeProps } from '@mantine/core';
import { capitalize } from '../lib/format';
import { ALERT_STATUS_COLOR, SEVERITY_COLOR, STATUS_COLOR } from '../lib/theme';
import type { AlertStatus, IncidentStatus, Severity } from '../types';

export function SeverityBadge({
  severity,
  ...props
}: { severity: Severity } & BadgeProps) {
  return (
    <Badge color={SEVERITY_COLOR[severity]} variant="light" {...props}>
      {capitalize(severity)}
    </Badge>
  );
}

export function StatusBadge({
  status,
  ...props
}: { status: IncidentStatus } & BadgeProps) {
  return (
    <Badge
      color={STATUS_COLOR[status]}
      variant={status === 'resolved' ? 'light' : 'dot'}
      {...props}
    >
      {capitalize(status)}
    </Badge>
  );
}

export function AlertStatusBadge({
  status,
  ...props
}: { status: AlertStatus } & BadgeProps) {
  return (
    <Badge
      color={ALERT_STATUS_COLOR[status]}
      variant={status === 'resolved' ? 'light' : 'dot'}
      {...props}
    >
      {capitalize(status)}
    </Badge>
  );
}
