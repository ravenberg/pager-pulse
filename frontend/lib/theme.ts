import {
  type MantineColorsTuple,
  createTheme,
  defaultVariantColorsResolver,
} from '@mantine/core';
import type { AlertStatus, IncidentStatus, Severity } from '../types';

/**
 * Colour carries meaning here, so there is little of it. Controls are ink:
 * near-black in light mode, near-white in dark. Indigo is the brand, for the
 * logo, links and illustrations. Red means urgent and nothing else: a
 * critical incident, a firing alert, a page, a destructive action.
 */
const ink: MantineColorsTuple = [
  '#f8f9fa',
  '#f1f3f5',
  '#e9ecef',
  '#dee2e6',
  '#ced4da',
  '#adb5bd',
  '#868e96',
  '#495057',
  '#343a40',
  '#212529',
];

export const BRAND = 'indigo';

export const theme = createTheme({
  colors: { ink },
  primaryColor: 'ink',
  primaryShade: { light: 9, dark: 1 },
  autoContrast: true,
  // Ink is near-black in light mode and near-white in dark mode, so its text
  // colour has to follow the scheme; autoContrast picks one for both.
  variantColorResolver: (input) => {
    const colors = defaultVariantColorsResolver(input);
    const ink = (input.color ?? input.theme.primaryColor) === 'ink';
    return ink && input.variant === 'filled'
      ? { ...colors, color: 'var(--mantine-primary-color-contrast)' }
      : colors;
  },
  defaultRadius: 'md',
  fontFamily:
    'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
  headings: { fontWeight: '650' },
  components: {
    Anchor: { defaultProps: { c: `${BRAND}.6` } },
  },
});

/** Only critical is red; minor is not a warning, so it stays grey. */
export const SEVERITY_COLOR: Record<Severity, string> = {
  critical: 'red',
  major: 'orange',
  minor: 'gray',
};

/** Shown as a small dot beside the label, not as a coloured block. */
export const STATUS_COLOR: Record<IncidentStatus, string> = {
  investigating: 'orange',
  identified: 'yellow',
  monitoring: 'blue',
  resolved: 'green',
};

export const ALERT_STATUS_COLOR: Record<AlertStatus, string> = {
  firing: 'red',
  acknowledged: 'yellow',
  resolved: 'green',
};
