import { createTheme } from '@mantine/core';
import type { IncidentStatus, Severity } from '../types';

export const theme = createTheme({
  primaryColor: 'red',
  defaultRadius: 'md',
  fontFamily:
    'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
  headings: { fontWeight: '650' },
});

export const SEVERITY_COLOR: Record<Severity, string> = {
  critical: 'red',
  major: 'orange',
  minor: 'yellow',
};

export const STATUS_COLOR: Record<IncidentStatus, string> = {
  investigating: 'red',
  identified: 'orange',
  monitoring: 'blue',
  resolved: 'green',
};
