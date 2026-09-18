import { Box, Stack, Text } from '@mantine/core';
import type { ReactNode } from 'react';

/**
 * unDraw illustrations (undraw.co, free to use without attribution), with
 * their fixed colours swapped for theme variables so they follow the brand
 * accent and read in dark mode too: the accent becomes --illo-accent, the
 * greys become --illo-ink, --illo-soft and --illo-paper. Skin and hair keep
 * their own colours.
 */
const SOURCES = import.meta.glob<string>('../illustrations/*.svg', {
  query: '?raw',
  import: 'default',
  eager: true,
});

export type IllustrationName =
  | 'access-denied'
  | 'coffee-break'
  | 'done'
  | 'fixing-bugs'
  | 'mail-sent'
  | 'page-not-found'
  | 'relaxing-at-home'
  | 'server-status'
  | 'the-void';

function roleOf(hex: string) {
  const h = hex.length === 4 ? hex.replace(/(\w)/g, '$1$1') : hex;
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  if (h.toLowerCase() === '#6c63ff') return 'accent';
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max - min > 0.12) return null; // coloured: skin, hair, plants
  if (max > 0.97) return 'paper';
  if (max > 0.7) return 'soft';
  if (max < 0.35) return 'ink';
  return null;
}

const themed = new Map<string, string>();
function svgOf(name: IllustrationName) {
  if (!themed.has(name)) {
    const raw = SOURCES[`../illustrations/${name}.svg`] ?? '';
    themed.set(
      name,
      raw
        // Size comes from the container; the viewBox keeps the proportions.
        .replace(/<svg([^>]*?)\s(width|height)="[^"]*"/g, '<svg$1')
        .replace(/<svg([^>]*?)\s(width|height)="[^"]*"/g, '<svg$1')
        .replace(/(fill|stroke)="(#[0-9a-fA-F]{3,6})"/g, (match, attr, hex) => {
          const role = roleOf(hex);
          return role ? `style="${attr}:var(--illo-${role})"` : match;
        }),
    );
  }
  return themed.get(name)!;
}

export function Illustration({
  name,
  width = 220,
}: {
  name: IllustrationName;
  width?: number;
}) {
  return (
    <Box
      w={width}
      maw="100%"
      aria-hidden
      style={{ lineHeight: 0 }}
      dangerouslySetInnerHTML={{ __html: svgOf(name) }}
    />
  );
}

/** An empty or quiet state: a picture, a line, and maybe what to do next. */
export function EmptyState({
  illustration,
  title,
  children,
  width = 200,
}: {
  illustration: IllustrationName;
  title: string;
  children?: ReactNode;
  width?: number;
}) {
  return (
    <Stack align="center" gap={6} py="xl" ta="center">
      <Illustration name={illustration} width={width} />
      <Text fw={600} mt="md">
        {title}
      </Text>
      {children && (
        <Text size="sm" c="dimmed" maw={420}>
          {children}
        </Text>
      )}
    </Stack>
  );
}
