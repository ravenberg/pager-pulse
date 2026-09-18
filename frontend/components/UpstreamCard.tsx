import {
  Anchor,
  Card,
  Group,
  Skeleton,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { IconCloudOff } from '@tabler/icons-react';
import { Deferred } from 'nestjs-mvc/react';

export interface UpstreamStatus {
  name: string;
  url: string;
  indicator: 'none' | 'minor' | 'major' | 'critical' | 'unknown';
  description: string;
}

/** Statuspage's own scale; a dot beside the words, never colour alone. */
const DOT: Record<UpstreamStatus['indicator'], string> = {
  none: 'green',
  minor: 'yellow',
  major: 'orange',
  critical: 'red',
  unknown: 'gray',
};

function Dot({ color }: { color: string }) {
  return (
    <span
      aria-hidden
      style={{
        flexShrink: 0,
        width: 8,
        height: 8,
        borderRadius: 4,
        background: `var(--mantine-color-${color}-filled)`,
      }}
    />
  );
}

/**
 * Is it us or them? A deferred prop the server rescues: when the status
 * pages can't be reached the page arrives with `rescuedProps: ['upstream']`
 * and <Deferred> shows `rescue` instead of waiting forever.
 */
export function UpstreamCard({ upstream }: { upstream?: UpstreamStatus[] }) {
  return (
    <Card withBorder padding="lg" data-xray="upstream">
      <Title order={4} mb="md">
        Upstream
      </Title>
      <Deferred
        data="upstream"
        fallback={
          <Stack gap="sm">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} height={16} />
            ))}
          </Stack>
        }
        rescue={
          <Group gap="xs" wrap="nowrap" c="dimmed">
            <IconCloudOff size={18} />
            <Text size="sm">
              Couldn’t reach the providers’ status pages just now.
            </Text>
          </Group>
        }
      >
        <Stack gap="xs">
          {upstream?.map((provider) => (
            <Group key={provider.name} justify="space-between" wrap="nowrap">
              <Group gap={8} wrap="nowrap">
                <Dot color={DOT[provider.indicator]} />
                <Anchor
                  href={provider.url}
                  target="_blank"
                  size="sm"
                  c="var(--mantine-color-text)"
                >
                  {provider.name}
                </Anchor>
              </Group>
              <Text size="xs" c="dimmed" ta="right" truncate>
                {provider.description}
              </Text>
            </Group>
          ))}
        </Stack>
      </Deferred>
    </Card>
  );
}
