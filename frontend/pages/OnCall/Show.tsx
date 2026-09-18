import {
  ActionIcon,
  Anchor,
  Avatar,
  Button,
  Card,
  Group,
  Modal,
  Select,
  Stack,
  Table,
  Text,
  Title,
  Tooltip,
} from '@mantine/core';
import { DateTimePicker } from '@mantine/dates';
import { useDebouncedValue, useDisclosure } from '@mantine/hooks';
import {
  IconChevronLeft,
  IconChevronRight,
  IconPhoneCall,
  IconPlus,
  IconTrash,
} from '@tabler/icons-react';
import { Link, router, useForm } from 'nestjs-mvc/react';
import { type FormEvent, useEffect } from 'react';
import { PageHeader } from '../../components/PageHeader';
import { colorOf, type Shift, ShiftBar } from '../../components/ShiftBar';
import { dateTime, relative } from '../../lib/format';
import { appLayout } from '../../layouts/AppLayout';
import type { Person } from '../../types';

interface Preview {
  from: string;
  until: string;
  before: Shift[];
  after: Shift[];
  hours: number;
  shifts: number;
  replaces: string[];
}

interface Props {
  schedule: { id: number; name: string; shiftHours: number; members: Person[] };
  window: { from: string; until: string };
  onCall: Person | null;
  shifts: Shift[];
  overrides: { id: number; user: Person; startsAt: string; endsAt: string }[];
  users: Person[];
  /** Only there after the form asked for it. */
  preview?: Preview | null;
  canRespond: boolean;
}

const DAY = 24 * 60 * 60 * 1000;
/** Mantine's local "YYYY-MM-DD HH:mm:ss" as an instant. */
const iso = (local: string | null) =>
  local ? new Date(local.replace(' ', 'T')).toISOString() : '';
const day = (date: Date) => date.toISOString().slice(0, 10);

const duration = (hours: number) =>
  hours >= 48
    ? `${Math.round(hours / 24)} days`
    : hours >= 24
      ? `${Math.floor(hours / 24)} day${hours % 24 ? ` ${hours % 24} hours` : ''}`
      : `${hours} hours`;

function OverrideForm({
  schedule,
  users,
  preview,
  onDone,
}: Pick<Props, 'schedule' | 'users' | 'preview'> & { onDone: () => void }) {
  const form = useForm({
    userId: null as string | null,
    startsAt: null as string | null,
    endsAt: null as string | null,
  });

  // While the form is filled in, ask the server for the `preview` prop with
  // the values so far: a partial reload of this page, the URL untouched.
  const [values] = useDebouncedValue(form.data, 250);
  useEffect(() => {
    if (!values.userId || !values.startsAt || !values.endsAt) return;
    router.reload({
      only: ['preview'],
      data: {
        previewUserId: values.userId,
        previewFrom: iso(values.startsAt),
        previewUntil: iso(values.endsAt),
      },
      preserveUrl: true,
    });
  }, [values]);

  function submit(event: FormEvent) {
    event.preventDefault();
    form.transform((data) => ({
      ...data,
      startsAt: iso(data.startsAt),
      endsAt: iso(data.endsAt),
    }));
    form.post(`/on-call/${schedule.id}/overrides`, {
      preserveScroll: true,
      onSuccess: () => {
        form.reset();
        onDone();
      },
    });
  }

  const cover = users.find((u) => String(u.id) === form.data.userId);
  const ready = form.data.userId && form.data.startsAt && form.data.endsAt;

  return (
    <form onSubmit={submit}>
      <Stack>
        <Select
          label="Who is providing cover?"
          placeholder="Search people"
          searchable
          data={users.map((u) => ({ value: String(u.id), label: u.name }))}
          value={form.data.userId}
          onChange={(value) => form.setData('userId', value)}
          error={form.errors.userId}
        />
        <Group grow>
          <DateTimePicker
            label="Cover from"
            placeholder="Pick a moment"
            value={form.data.startsAt}
            onChange={(value) => form.setData('startsAt', value)}
            error={form.errors.startsAt}
          />
          <DateTimePicker
            label="Until"
            placeholder="Pick a moment"
            value={form.data.endsAt}
            onChange={(value) => form.setData('endsAt', value)}
            error={form.errors.endsAt}
          />
        </Group>

        {ready && preview && cover && (
          <Card withBorder padding="md" data-xray="preview">
            <Text size="xs" fw={600} c="dimmed" mb={4}>
              Before
            </Text>
            <ShiftBar
              shifts={preview.before}
              from={preview.from}
              until={preview.until}
              height={26}
              ticks={false}
            />
            <Text size="xs" fw={600} c="dimmed" mt="sm" mb={4}>
              After
            </Text>
            <ShiftBar
              shifts={preview.after}
              from={preview.from}
              until={preview.until}
              height={26}
              ticks={false}
            />
            <Text size="sm" mt="sm">
              <b>{cover.name}</b> will cover {schedule.name} for{' '}
              {duration(preview.hours)}
              {preview.shifts > 0
                ? `, over ${preview.shifts} shift${preview.shifts === 1 ? '' : 's'}, taking over from ${preview.replaces.join(' and ')}.`
                : ': they were on call then anyway.'}
            </Text>
          </Card>
        )}
        {ready && preview === null && (
          <Text size="sm" c="dimmed">
            Pick an end after the start to see the effect.
          </Text>
        )}

        <Group justify="flex-end">
          <Button variant="default" onClick={onDone}>
            Cancel
          </Button>
          <Button type="submit" loading={form.processing}>
            Save override
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

export default function Show({
  schedule,
  window,
  onCall,
  shifts,
  overrides,
  users,
  preview,
  canRespond,
}: Props) {
  const [opened, { open, close }] = useDisclosure(false);
  const from = new Date(window.from);
  const move = (days: number) =>
    router.get(
      `/on-call/${schedule.id}`,
      { from: day(new Date(from.getTime() + days * DAY)) },
      { only: ['shifts', 'window'], preserveState: true, preserveScroll: true },
    );

  return (
    <>
      <Anchor
        component={Link}
        href="/on-call?tab=schedules"
        size="sm"
        c="dimmed"
      >
        ← On-call
      </Anchor>
      <PageHeader
        title={schedule.name}
        description={`${schedule.members.length} people take turns, ${schedule.shiftHours % 24 === 0 ? `${schedule.shiftHours / 24} day` : `${schedule.shiftHours} hour`} shifts.`}
        actions={
          canRespond && (
            <Button leftSection={<IconPlus size={16} />} onClick={open}>
              Create override
            </Button>
          )
        }
      />

      <Card withBorder padding="lg" mb="lg" data-xray="shifts">
        <Group justify="space-between" mb="md">
          <Group gap="xs">
            <Text size="sm" c="dimmed">
              On call now:
            </Text>
            {onCall ? (
              <Group gap={6}>
                <Avatar size="sm" color={colorOf(onCall)} radius="xl">
                  <IconPhoneCall size={12} />
                </Avatar>
                <Text size="sm" fw={600}>
                  {onCall.name}
                </Text>
              </Group>
            ) : (
              <Text size="sm">nobody</Text>
            )}
          </Group>
          <Group gap={4}>
            <Button
              variant="default"
              size="xs"
              onClick={() =>
                move(Math.round((Date.now() - from.getTime()) / DAY))
              }
            >
              Today
            </Button>
            <ActionIcon
              variant="default"
              aria-label="Earlier"
              onClick={() => move(-7)}
            >
              <IconChevronLeft size={16} />
            </ActionIcon>
            <ActionIcon
              variant="default"
              aria-label="Later"
              onClick={() => move(7)}
            >
              <IconChevronRight size={16} />
            </ActionIcon>
            <Text size="sm" ml="xs">
              {from.toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'short',
              })}{' '}
              –{' '}
              {new Date(Date.parse(window.until) - 1).toLocaleDateString(
                'en-GB',
                {
                  day: 'numeric',
                  month: 'short',
                },
              )}
            </Text>
          </Group>
        </Group>
        <ShiftBar
          shifts={shifts}
          from={window.from}
          until={window.until}
          height={40}
        />
      </Card>

      <Card withBorder padding="lg" data-xray="overrides">
        <Title order={5} mb="sm">
          Overrides
        </Title>
        {overrides.length === 0 ? (
          <Text size="sm" c="dimmed">
            None coming up. Covering for a colleague? Create an override.
          </Text>
        ) : (
          <Table verticalSpacing="xs">
            <Table.Tbody>
              {overrides.map((override) => (
                <Table.Tr key={override.id}>
                  <Table.Td>
                    <Text size="sm" fw={600}>
                      {override.user.name}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c="dimmed">
                      {dateTime(override.startsAt)} →{' '}
                      {dateTime(override.endsAt)}
                      {Date.parse(override.startsAt) <= Date.now()
                        ? ' · now'
                        : ` · ${relative(override.startsAt)}`}
                    </Text>
                  </Table.Td>
                  <Table.Td w={40}>
                    {canRespond && (
                      <Tooltip label="Remove override">
                        <ActionIcon
                          variant="subtle"
                          color="gray"
                          aria-label="Remove override"
                          onClick={() =>
                            router.delete(
                              `/on-call/${schedule.id}/overrides/${override.id}`,
                              { preserveScroll: true },
                            )
                          }
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Tooltip>
                    )}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Card>

      <Modal opened={opened} onClose={close} title="Create override" size="lg">
        <OverrideForm
          schedule={schedule}
          users={users}
          preview={preview}
          onDone={close}
        />
      </Modal>
    </>
  );
}

Show.layout = appLayout;
