import {
  ActionIcon,
  Anchor,
  Avatar,
  Badge,
  Button,
  Card,
  Group,
  SimpleGrid,
  Stack,
  Table,
  Tabs,
  Text,
  Title,
  Tooltip,
} from '@mantine/core';
import {
  IconArrowDown,
  IconPhoneCall,
  IconPlus,
  IconTrash,
} from '@tabler/icons-react';
import { Link, router, usePage } from 'nestjs-mvc/react';
import { useState } from 'react';
import { EscalateButton } from '../../components/EscalateButton';
import { EmptyState } from '../../components/Illustration';
import { PageHeader } from '../../components/PageHeader';
import { colorOf, type Shift } from '../../components/ShiftBar';
import { relative } from '../../lib/format';
import { appLayout } from '../../layouts/AppLayout';
import type { EscalationRow, Person } from '../../types';

interface Props {
  schedules: {
    id: number;
    name: string;
    shiftHours: number;
    isMember: boolean;
    members: Person[];
    current: Shift | null;
    next: Shift | null;
  }[];
  paths: {
    id: number;
    name: string;
    levels: {
      target: string;
      kind: 'schedule' | 'user';
      now: Person | null;
      delayMinutes: number;
    }[];
  }[];
  escalations: EscalationRow[];
  canManage: boolean;
}

const shiftLength = (hours: number) =>
  hours % 168 === 0
    ? `${hours / 168}w`
    : hours % 24 === 0
      ? `${hours / 24}d`
      : `${hours}h`;

function Escalations({ escalations }: Pick<Props, 'escalations'>) {
  if (!escalations.length)
    return (
      <EmptyState illustration="coffee-break" title="Nobody has been paged">
        Pages from the last day show up here, with who they reached.
      </EmptyState>
    );
  return (
    <Card withBorder padding={0} data-xray="escalations">
      <Table verticalSpacing="sm" horizontalSpacing="md">
        <Table.Tbody>
          {escalations.map((e) => (
            <Table.Tr key={e.id} opacity={e.acknowledged ? 0.65 : 1}>
              <Table.Td>
                <Text size="sm" fw={600}>
                  {e.reason}
                </Text>
                <Text size="xs" c="dimmed">
                  {e.path} · {relative(e.createdAt)}
                  {e.createdBy && ` by ${e.createdBy.name}`}
                  {e.incident && (
                    <>
                      {' · '}
                      <Anchor
                        component={Link}
                        href={`/incidents/${e.incident.id}`}
                        size="xs"
                      >
                        {e.incident.reference}
                      </Anchor>
                    </>
                  )}
                  {e.alert && ` · alert: ${e.alert.title}`}
                </Text>
              </Table.Td>
              <Table.Td>
                {e.acknowledged ? (
                  <Badge variant="light" color="green">
                    Acknowledged
                    {e.acknowledgedBy && ` by ${e.acknowledgedBy.name}`}
                  </Badge>
                ) : (
                  <Stack gap={2}>
                    <Text size="sm">
                      Paging <b>{e.paging?.name ?? 'nobody'}</b>
                    </Text>
                    <Text size="xs" c="dimmed">
                      Level {e.level} of {e.levels}
                      {e.escalatesAt &&
                        ` · next level ${relative(e.escalatesAt)}`}
                    </Text>
                  </Stack>
                )}
              </Table.Td>
              <Table.Td w={140}>
                {!e.acknowledged && (
                  <Button
                    size="xs"
                    variant="light"
                    onClick={() =>
                      router.post(
                        `/escalations/${e.id}/acknowledge`,
                        {},
                        { preserveScroll: true },
                      )
                    }
                  >
                    Acknowledge
                  </Button>
                )}
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Card>
  );
}

function Paths({ paths, canManage }: Pick<Props, 'paths' | 'canManage'>) {
  return (
    <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="lg" data-xray="paths">
      {paths.map((path) => (
        <Card key={path.id} withBorder padding="lg">
          <Group justify="space-between" mb="md">
            <Title order={4}>{path.name}</Title>
            {canManage && (
              <Tooltip label="Delete path">
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  aria-label="Delete path"
                  onClick={() =>
                    router.delete(`/on-call/paths/${path.id}`, {
                      preserveScroll: true,
                    })
                  }
                >
                  <IconTrash size={16} />
                </ActionIcon>
              </Tooltip>
            )}
          </Group>
          <Stack gap={4}>
            {path.levels.map((level, index) => (
              <div key={index}>
                <Group gap="sm" wrap="nowrap">
                  <Avatar size="sm" radius="xl" color="gray">
                    {index + 1}
                  </Avatar>
                  <div>
                    <Text size="sm" fw={600}>
                      {level.target}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {level.kind === 'schedule'
                        ? `whoever is on call: ${level.now?.name ?? 'nobody'} now`
                        : 'this person'}
                    </Text>
                  </div>
                </Group>
                {index < path.levels.length - 1 && (
                  <Group gap={6} ml={6} my={4}>
                    <IconArrowDown
                      size={14}
                      color="var(--mantine-color-dimmed)"
                    />
                    <Text size="xs" c="dimmed">
                      no answer in {level.delayMinutes} min
                    </Text>
                  </Group>
                )}
              </div>
            ))}
          </Stack>
        </Card>
      ))}
      {paths.length === 0 && <Text c="dimmed">No escalation paths yet.</Text>}
    </SimpleGrid>
  );
}

function Schedules({ schedules }: Pick<Props, 'schedules'>) {
  return (
    <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="lg" data-xray="schedules">
      {schedules.map((schedule) => (
        <Card
          key={schedule.id}
          withBorder
          padding="lg"
          component={Link}
          href={`/on-call/${schedule.id}`}
        >
          <Group justify="space-between" mb="md">
            <Group gap="xs">
              <Title order={4}>{schedule.name}</Title>
              <Badge variant="light" color="gray">
                {shiftLength(schedule.shiftHours)} shifts
              </Badge>
              {schedule.isMember && (
                <Badge variant="light">You're in this rotation</Badge>
              )}
            </Group>
          </Group>
          <Group wrap="nowrap">
            <Avatar color={colorOf(schedule.current?.user ?? null)} radius="xl">
              <IconPhoneCall size={18} />
            </Avatar>
            <Stack gap={0}>
              <Text fw={700}>
                {schedule.current?.user?.name ?? 'Nobody'}
                {schedule.current?.override && (
                  <Badge ml={6} size="xs" variant="outline">
                    Override
                  </Badge>
                )}
              </Text>
              <Text size="sm" c="dimmed">
                {schedule.current
                  ? `On call now · hands over ${relative(schedule.current.endsAt)}`
                  : 'Nobody on call yet'}
                {schedule.next?.user && ` to ${schedule.next.user.name}`}
              </Text>
            </Stack>
          </Group>
        </Card>
      ))}
      {schedules.length === 0 && <Text c="dimmed">No schedules yet.</Text>}
    </SimpleGrid>
  );
}

export default function Index({
  schedules,
  paths,
  escalations,
  canManage,
}: Props) {
  const { url } = usePage();
  const [tab, setTab] = useState<string | null>(
    new URLSearchParams(url.split('?')[1]).get('tab') ?? 'escalations',
  );

  return (
    <>
      <PageHeader
        title="On-call"
        description="Who holds the pager, and who gets paged when they don't answer."
        actions={
          <Group gap="xs">
            {canManage && tab === 'schedules' && (
              <Button
                component={Link}
                href="/on-call/create"
                variant="default"
                leftSection={<IconPlus size={16} />}
              >
                New schedule
              </Button>
            )}
            {canManage && tab === 'paths' && (
              <Button
                component={Link}
                href="/on-call/paths/create"
                variant="default"
                leftSection={<IconPlus size={16} />}
              >
                New escalation path
              </Button>
            )}
            <EscalateButton paths={paths} variant="filled" />
          </Group>
        }
      />
      <Tabs value={tab} onChange={setTab}>
        <Tabs.List mb="lg">
          <Tabs.Tab value="escalations">
            Escalations
            {escalations.some((e) => !e.acknowledged) && (
              <Badge ml={6} size="xs" color="red" circle>
                {escalations.filter((e) => !e.acknowledged).length}
              </Badge>
            )}
          </Tabs.Tab>
          <Tabs.Tab value="paths">Escalation paths</Tabs.Tab>
          <Tabs.Tab value="schedules">Schedules</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="escalations">
          <Escalations escalations={escalations} />
        </Tabs.Panel>
        <Tabs.Panel value="paths">
          <Paths paths={paths} canManage={canManage} />
        </Tabs.Panel>
        <Tabs.Panel value="schedules">
          <Schedules schedules={schedules} />
        </Tabs.Panel>
      </Tabs>
    </>
  );
}

Index.layout = appLayout;
