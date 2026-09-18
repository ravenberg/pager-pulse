import {
  ActionIcon,
  Avatar,
  Badge,
  Button,
  Card,
  Group,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Title,
  Tooltip,
} from '@mantine/core';
import { IconPhoneCall, IconPlus, IconTrash } from '@tabler/icons-react';
import { Link, router } from 'nestjs-mvc/react';
import { PageHeader } from '../../components/PageHeader';
import { dateTime, relative } from '../../lib/format';
import { appLayout } from '../../layouts/AppLayout';
import type { Person } from '../../types';

interface Shift {
  user: Person | null;
  startsAt: string;
  endsAt: string;
}

interface Props {
  schedules: {
    id: number;
    name: string;
    shiftHours: number;
    isMember: boolean;
    members: Person[];
    shifts: Shift[];
  }[];
  canManage: boolean;
}

const shiftLength = (hours: number) =>
  hours % 168 === 0
    ? `${hours / 168}w`
    : hours % 24 === 0
      ? `${hours / 24}d`
      : `${hours}h`;

export default function Index({ schedules, canManage }: Props) {
  return (
    <>
      <PageHeader
        title="On-call"
        description="Rotations take turns automatically: no shifts to fill in."
        actions={
          canManage && (
            <Button
              component={Link}
              href="/on-call/create"
              leftSection={<IconPlus size={16} />}
            >
              New schedule
            </Button>
          )
        }
      />
      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="lg" data-xray="schedules">
        {schedules.map((schedule) => {
          const [current, ...upcoming] = schedule.shifts;
          return (
            <Card key={schedule.id} withBorder padding="lg">
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
                {canManage && (
                  <Tooltip label="Delete schedule">
                    <ActionIcon
                      variant="subtle"
                      color="gray"
                      aria-label="Delete schedule"
                      onClick={() => router.delete(`/on-call/${schedule.id}`)}
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Tooltip>
                )}
              </Group>

              {current && Date.parse(current.startsAt) <= Date.now() ? (
                <Card bg="var(--mantine-color-red-light)" padding="md" mb="md">
                  <Group>
                    <Avatar color="red" radius="xl" variant="filled">
                      <IconPhoneCall size={18} />
                    </Avatar>
                    <Stack gap={0}>
                      <Text fw={700}>{current.user?.name ?? 'Nobody'}</Text>
                      <Text size="sm" c="dimmed">
                        On call now · hands over {relative(current.endsAt)}
                      </Text>
                    </Stack>
                  </Group>
                </Card>
              ) : (
                <Text c="dimmed" mb="md">
                  Nobody is on call yet: the rotation starts{' '}
                  {current ? relative(current.startsAt) : 'later'}.
                </Text>
              )}

              <Text size="xs" c="dimmed" tt="uppercase" fw={600} mb={4}>
                Up next
              </Text>
              <Table verticalSpacing={6}>
                <Table.Tbody>
                  {upcoming.map((shift) => (
                    <Table.Tr key={shift.startsAt}>
                      <Table.Td>
                        <Text size="sm">{shift.user?.name ?? '—'}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" c="dimmed">
                          {dateTime(shift.startsAt)} → {dateTime(shift.endsAt)}
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Card>
          );
        })}
      </SimpleGrid>
      {schedules.length === 0 && <Text c="dimmed">No schedules yet.</Text>}
    </>
  );
}

Index.layout = appLayout;
