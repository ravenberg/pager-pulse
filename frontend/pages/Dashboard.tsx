import {
  Anchor,
  Avatar,
  Box,
  Card,
  Group,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { IconCircleCheck, IconPhoneCall } from '@tabler/icons-react';
import { Deferred, Link, usePage } from 'nestjs-mvc/react';
import { SeverityBadge, StatusBadge } from '../components/Badges';
import { PageHeader } from '../components/PageHeader';
import { duration, relative } from '../lib/format';
import { appLayout } from '../layouts/AppLayout';
import type { FollowUpRow, IncidentRow, Person, SharedProps } from '../types';

interface Props {
  active: IncidentRow[];
  onCall: {
    id: number;
    name: string;
    current: { user: Person | null; endsAt: string } | null;
  }[];
  myFollowUps: FollowUpRow[];
  stats?: {
    total: number;
    mttrMinutes: number | null;
    bySeverity: Record<string, number>;
    openFollowUps: number;
  };
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <Card withBorder padding="md">
      <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
        {label}
      </Text>
      <Text fz={28} fw={700}>
        {value}
      </Text>
    </Card>
  );
}

export default function Dashboard({
  active,
  onCall,
  myFollowUps,
  stats,
}: Props) {
  const { props } = usePage<SharedProps>();
  const firstName = props.auth.user?.name.split(' ')[0];

  return (
    <>
      <PageHeader
        title={`Hi ${firstName}`}
        description="What is on fire, who is holding the pager, and what is left to do."
      />

      {/* data-xray: what X-ray outlines for a prop. */}
      <Box data-xray="stats">
        <Deferred
          data="stats"
          fallback={
            <SimpleGrid cols={{ base: 2, md: 4 }} mb="xl">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} h={86} radius="md" />
              ))}
            </SimpleGrid>
          }
        >
          {stats && (
            <SimpleGrid cols={{ base: 2, md: 4 }} mb="xl">
              <Stat label="Incidents · 30 days" value={stats.total} />
              <Stat
                label="Critical · 30 days"
                value={stats.bySeverity.critical ?? 0}
              />
              <Stat
                label="Mean time to resolve"
                value={
                  stats.mttrMinutes === null
                    ? '—'
                    : duration(
                        new Date(0).toISOString(),
                        new Date(stats.mttrMinutes * 60000).toISOString(),
                      )
                }
              />
              <Stat label="Open follow-ups" value={stats.openFollowUps} />
            </SimpleGrid>
          )}
        </Deferred>
      </Box>

      <SimpleGrid cols={{ base: 1, md: 3 }} spacing="lg">
        <Card
          withBorder
          padding="lg"
          style={{ gridColumn: 'span 2' }}
          data-xray="active"
        >
          <Title order={4} mb="md">
            Active incidents
          </Title>
          {active.length === 0 ? (
            <Group>
              <ThemeIcon color="green" variant="light" radius="xl">
                <IconCircleCheck size={18} />
              </ThemeIcon>
              <Text c="dimmed">All quiet. Nothing is on fire.</Text>
            </Group>
          ) : (
            <Stack gap="sm">
              {active.map((incident) => (
                <Card
                  key={incident.id}
                  withBorder
                  padding="sm"
                  component={Link}
                  href={`/incidents/${incident.id}`}
                >
                  <Group justify="space-between" wrap="nowrap">
                    <div>
                      <Text fw={600}>
                        <Text span c="dimmed" fw={500}>
                          {incident.reference}
                        </Text>{' '}
                        {incident.title}
                      </Text>
                      <Text size="sm" c="dimmed">
                        Declared {relative(incident.declaredAt)} · lead{' '}
                        {incident.lead?.name ?? 'unassigned'}
                      </Text>
                    </div>
                    <Group gap="xs" wrap="nowrap">
                      <SeverityBadge severity={incident.severity} />
                      <StatusBadge status={incident.status} />
                    </Group>
                  </Group>
                </Card>
              ))}
            </Stack>
          )}
        </Card>

        <Stack gap="lg">
          <Card withBorder padding="lg" data-xray="onCall">
            <Group justify="space-between" mb="md">
              <Title order={4}>On call now</Title>
              <Anchor component={Link} href="/on-call" size="sm">
                Schedules
              </Anchor>
            </Group>
            <Stack gap="sm">
              {onCall.length === 0 && (
                <Text size="sm" c="dimmed">
                  No schedules yet, so nobody is holding the pager.
                </Text>
              )}
              {onCall.map((schedule) => (
                <Group key={schedule.id} wrap="nowrap">
                  <Avatar color="red" radius="xl">
                    <IconPhoneCall size={18} />
                  </Avatar>
                  <div>
                    <Text fw={600} size="sm">
                      {schedule.current?.user?.name ?? 'Nobody'}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {schedule.name}
                      {schedule.current &&
                        ` · hands over ${relative(schedule.current.endsAt)}`}
                    </Text>
                  </div>
                </Group>
              ))}
            </Stack>
          </Card>

          <Card withBorder padding="lg" data-xray="myFollowUps">
            <Group justify="space-between" mb="md">
              <Title order={4}>Your follow-ups</Title>
              <Anchor component={Link} href="/follow-ups" size="sm">
                All
              </Anchor>
            </Group>
            {myFollowUps.length === 0 ? (
              <Text c="dimmed" size="sm">
                Nothing assigned to you.
              </Text>
            ) : (
              <Stack gap="xs">
                {myFollowUps.map((item) => (
                  <div key={item.id}>
                    <Text size="sm">{item.title}</Text>
                    {item.incident && (
                      <Anchor
                        component={Link}
                        href={`/incidents/${item.incident.id}`}
                        size="xs"
                        c="dimmed"
                      >
                        {item.incident.reference} · {item.incident.title}
                      </Anchor>
                    )}
                  </div>
                ))}
              </Stack>
            )}
          </Card>
        </Stack>
      </SimpleGrid>
    </>
  );
}

Dashboard.layout = appLayout;
