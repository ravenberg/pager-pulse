import {
  Anchor,
  Avatar,
  Card,
  Group,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { IconPhoneCall } from '@tabler/icons-react';
import { Link, usePage } from 'nestjs-mvc/react';
import { EmptyState } from '../components/Illustration';
import { IncidentBoard } from '../components/IncidentBoard';
import {
  InsightsSection,
  type InsightsProps,
} from '../components/InsightsSection';
import { PageHeader } from '../components/PageHeader';
import { UpstreamCard, type UpstreamStatus } from '../components/UpstreamCard';
import { relative } from '../lib/format';
import { appLayout } from '../layouts/AppLayout';
import type { FollowUpRow, IncidentRow, Person, SharedProps } from '../types';

interface Props extends InsightsProps {
  active: IncidentRow[];
  onCall: {
    id: number;
    name: string;
    current: { user: Person | null; endsAt: string } | null;
  }[];
  myFollowUps: FollowUpRow[];
  upstream?: UpstreamStatus[];
}

export default function Dashboard({
  active,
  onCall,
  myFollowUps,
  upstream,
  ...insights
}: Props) {
  const { props } = usePage<SharedProps>();
  const firstName = props.auth.user?.name.split(' ')[0];

  return (
    <>
      <PageHeader
        title={`Hi ${firstName}`}
        description="What is on fire, who is holding the pager, and what is left to do."
      />

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
            <EmptyState
              illustration="relaxing-at-home"
              title="All quiet. Nothing is on fire."
            >
              When something breaks, declare an incident and it shows up here.
            </EmptyState>
          ) : (
            <IncidentBoard
              active={active}
              canMove={props.auth.user?.role !== 'viewer'}
            />
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
                  <Avatar color="gray" radius="xl">
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

          <UpstreamCard upstream={upstream} />

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

      <InsightsSection {...insights} />
    </>
  );
}

Dashboard.layout = appLayout;
