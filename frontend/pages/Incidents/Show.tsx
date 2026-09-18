import {
  Anchor,
  Badge,
  Button,
  Card,
  Divider,
  Grid,
  Group,
  Select,
  Stack,
  Switch,
  Text,
  Textarea,
  TextInput,
  ThemeIcon,
  Timeline,
  Title,
  Tooltip,
} from '@mantine/core';
import {
  IconArrowsExchange,
  IconChecklist,
  IconFlame,
  IconMessage,
  IconSpeakerphone,
  IconUserStar,
  IconWorld,
} from '@tabler/icons-react';
import { Head, Link, router, useForm, usePoll } from 'nestjs-mvc/react';
import type { FormEvent } from 'react';
import {
  AlertStatusBadge,
  SeverityBadge,
  StatusBadge,
} from '../../components/Badges';
import { FollowUpItem } from '../../components/FollowUpItem';
import { capitalize, dateTime, duration, relative } from '../../lib/format';
import { appLayout } from '../../layouts/AppLayout';
import type {
  AlertRow,
  FollowUpRow,
  IncidentRow,
  IncidentStatus,
  Person,
  Severity,
} from '../../types';

interface Entry {
  id: number;
  kind: 'declared' | 'update' | 'status' | 'severity' | 'lead' | 'follow_up';
  body: string;
  isPublic: boolean;
  author: Person | null;
  createdAt: string;
}

interface Props {
  incident: IncidentRow & {
    summary: string;
    isPublic: boolean;
    reporter: Person | null;
  };
  timeline: Entry[];
  followUps: FollowUpRow[];
  alerts: AlertRow[];
  users: Person[];
  canRespond: boolean;
}

const KIND_ICON = {
  declared: IconFlame,
  update: IconMessage,
  status: IconArrowsExchange,
  severity: IconArrowsExchange,
  lead: IconUserStar,
  follow_up: IconChecklist,
};

const STATUSES: IncidentStatus[] = [
  'investigating',
  'identified',
  'monitoring',
  'resolved',
];
const SEVERITIES: Severity[] = ['critical', 'major', 'minor'];
const options = (values: string[]) =>
  values.map((value) => ({ value, label: capitalize(value) }));

function PostUpdate({ incident }: { incident: Props['incident'] }) {
  const form = useForm({
    body: '',
    isPublic: incident.isPublic,
    status: incident.status,
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    // Only send the status when it changes, so the timeline gets no empty "changed to" entry.
    form.transform((data) => ({
      ...data,
      status: data.status === incident.status ? undefined : data.status,
    }));
    form.post(`/incidents/${incident.id}/updates`, {
      preserveScroll: true,
      onSuccess: () => form.reset('body'),
    });
  }

  return (
    <Card withBorder padding="md">
      <form onSubmit={submit}>
        <Stack gap="sm">
          <Textarea
            placeholder="Share an update: what changed, what is next?"
            autosize
            minRows={2}
            value={form.data.body}
            onChange={(e) => form.setData('body', e.currentTarget.value)}
            error={form.errors.body}
          />
          <Group justify="space-between">
            <Group gap="md">
              <Select
                size="xs"
                w={150}
                aria-label="Status"
                data={options(STATUSES)}
                value={form.data.status}
                onChange={(value) =>
                  value && form.setData('status', value as IncidentStatus)
                }
                allowDeselect={false}
              />
              <Tooltip
                label={
                  incident.isPublic
                    ? 'Also post this on the status page'
                    : 'This incident is not public'
                }
              >
                <Switch
                  size="xs"
                  label="Public"
                  disabled={!incident.isPublic}
                  checked={form.data.isPublic}
                  onChange={(e) =>
                    form.setData('isPublic', e.currentTarget.checked)
                  }
                />
              </Tooltip>
            </Group>
            <Button
              size="xs"
              type="submit"
              loading={form.processing}
              leftSection={<IconSpeakerphone size={14} />}
            >
              Post update
            </Button>
          </Group>
        </Stack>
      </form>
    </Card>
  );
}

function AddFollowUp({
  incidentId,
  users,
}: {
  incidentId: number;
  users: Person[];
}) {
  const form = useForm({ title: '', assigneeId: null as string | null });

  function submit(event: FormEvent) {
    event.preventDefault();
    form.post(`/incidents/${incidentId}/follow-ups`, {
      preserveScroll: true,
      onSuccess: () => form.reset(),
    });
  }

  return (
    <form onSubmit={submit}>
      <Stack gap="xs">
        <TextInput
          size="xs"
          placeholder="Add a follow-up"
          value={form.data.title}
          onChange={(e) => form.setData('title', e.currentTarget.value)}
          error={form.errors.title}
        />
        {form.data.title && (
          <Group gap="xs" wrap="nowrap">
            <Select
              size="xs"
              placeholder="Assignee"
              clearable
              searchable
              style={{ flex: 1 }}
              data={users.map((user) => ({
                value: String(user.id),
                label: user.name,
              }))}
              value={form.data.assigneeId}
              onChange={(value) => form.setData('assigneeId', value)}
            />
            <Button size="xs" type="submit" loading={form.processing}>
              Add
            </Button>
          </Group>
        )}
      </Stack>
    </form>
  );
}

function Property({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Group justify="space-between" wrap="nowrap" gap="xs">
      <Text size="sm" c="dimmed">
        {label}
      </Text>
      {children}
    </Group>
  );
}

export default function Show({
  incident,
  timeline,
  followUps,
  alerts,
  users,
  canRespond,
}: Props) {
  // Somebody else may be working this incident: refresh just the moving parts.
  usePoll(10_000, { only: ['incident', 'timeline', 'followUps', 'alerts'] });

  const change = (data: Record<string, string | null>) =>
    router.patch(`/incidents/${incident.id}`, data, {
      preserveScroll: true,
      preserveState: true,
    });

  return (
    <>
      <Head title={`${incident.reference} ${incident.title} · PagerPulse`} />
      <Anchor component={Link} href="/incidents" size="sm" c="dimmed">
        ← Incidents
      </Anchor>
      <Group mt="xs" mb="lg" gap="sm">
        <Title order={2}>
          <Text span inherit c="dimmed">
            {incident.reference}
          </Text>{' '}
          {incident.title}
        </Title>
        <SeverityBadge severity={incident.severity} size="lg" />
        <StatusBadge status={incident.status} size="lg" />
      </Group>

      <Grid gap="lg">
        <Grid.Col span={{ base: 12, md: 8 }}>
          <Stack>
            {canRespond && (
              <PostUpdate key={incident.status} incident={incident} />
            )}
            <Card withBorder padding="lg" data-xray="timeline">
              <Title order={4} mb="md">
                Timeline
              </Title>
              <Timeline bulletSize={28} lineWidth={2}>
                {timeline.map((entry) => {
                  const Icon = KIND_ICON[entry.kind];
                  return (
                    <Timeline.Item
                      key={entry.id}
                      bullet={
                        <ThemeIcon
                          size={28}
                          radius="xl"
                          variant={entry.kind === 'update' ? 'filled' : 'light'}
                          color={entry.kind === 'declared' ? 'red' : 'gray'}
                        >
                          <Icon size={15} />
                        </ThemeIcon>
                      }
                      title={
                        <Group gap={6}>
                          <Text size="sm" fw={600}>
                            {entry.author?.name ?? 'PagerPulse'}
                          </Text>
                          {entry.isPublic && (
                            <Badge
                              size="xs"
                              variant="light"
                              leftSection={<IconWorld size={10} />}
                            >
                              Public
                            </Badge>
                          )}
                        </Group>
                      }
                    >
                      <Text
                        size="sm"
                        c={entry.kind === 'update' ? undefined : 'dimmed'}
                        style={{ whiteSpace: 'pre-wrap' }}
                      >
                        {entry.body}
                      </Text>
                      <Tooltip label={dateTime(entry.createdAt)}>
                        <Text size="xs" c="dimmed" mt={4} w="fit-content">
                          {relative(entry.createdAt)}
                        </Text>
                      </Tooltip>
                    </Timeline.Item>
                  );
                })}
              </Timeline>
            </Card>
          </Stack>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 4 }}>
          <Stack>
            <Card withBorder padding="lg" data-xray="incident users">
              <Stack gap="sm">
                <Property label="Status">
                  <Select
                    size="xs"
                    w={150}
                    disabled={!canRespond}
                    data={options(STATUSES)}
                    value={incident.status}
                    allowDeselect={false}
                    onChange={(status) => status && change({ status })}
                  />
                </Property>
                <Property label="Severity">
                  <Select
                    size="xs"
                    w={150}
                    disabled={!canRespond}
                    data={options(SEVERITIES)}
                    value={incident.severity}
                    allowDeselect={false}
                    onChange={(severity) => severity && change({ severity })}
                  />
                </Property>
                <Property label="Lead">
                  <Select
                    size="xs"
                    w={150}
                    disabled={!canRespond}
                    placeholder="Unassigned"
                    searchable
                    clearable
                    data={users.map((user) => ({
                      value: String(user.id),
                      label: user.name,
                    }))}
                    value={incident.lead ? String(incident.lead.id) : null}
                    onChange={(leadId) => change({ leadId })}
                  />
                </Property>
                <Divider />
                <Property label="Reporter">
                  <Text size="sm">{incident.reporter?.name ?? '—'}</Text>
                </Property>
                <Property label="Declared">
                  <Text size="sm">{dateTime(incident.declaredAt)}</Text>
                </Property>
                <Property label={incident.resolvedAt ? 'Lasted' : 'Open for'}>
                  <Text size="sm">
                    {duration(incident.declaredAt, incident.resolvedAt)}
                  </Text>
                </Property>
                <Property label="Services">
                  <Group gap={4} justify="flex-end">
                    {incident.services.length ? (
                      incident.services.map((service) => (
                        <Badge
                          key={service}
                          variant="outline"
                          color="gray"
                          size="sm"
                        >
                          {service}
                        </Badge>
                      ))
                    ) : (
                      <Text size="sm">—</Text>
                    )}
                  </Group>
                </Property>
                <Property label="Status page">
                  {incident.isPublic ? (
                    <Anchor
                      href={`/status/incidents/${incident.id}`}
                      target="_blank"
                      size="sm"
                    >
                      Public
                    </Anchor>
                  ) : (
                    <Text size="sm">Internal</Text>
                  )}
                </Property>
              </Stack>
            </Card>

            <Card withBorder padding="lg" data-xray="followUps">
              <Title order={5} mb="sm">
                Follow-ups
              </Title>
              <Stack gap="sm">
                {followUps.length === 0 && (
                  <Text size="sm" c="dimmed">
                    None yet.
                  </Text>
                )}
                {followUps.map((item) => (
                  <FollowUpItem
                    key={item.id}
                    item={item}
                    canRespond={canRespond}
                  />
                ))}
                {canRespond && (
                  <AddFollowUp incidentId={incident.id} users={users} />
                )}
              </Stack>
            </Card>

            {alerts.length > 0 && (
              <Card withBorder padding="lg" data-xray="alerts">
                <Title order={5} mb="sm">
                  Alerts
                </Title>
                <Stack gap="sm">
                  {alerts.map((alert) => (
                    <Group
                      key={alert.id}
                      justify="space-between"
                      wrap="nowrap"
                      align="flex-start"
                    >
                      <div>
                        <Text size="sm">{alert.title}</Text>
                        <Text size="xs" c="dimmed">
                          {alert.source.name} · {relative(alert.firstSeenAt)}
                          {alert.occurrences > 1 && ` · ×${alert.occurrences}`}
                        </Text>
                      </div>
                      <AlertStatusBadge status={alert.status} size="sm" />
                    </Group>
                  ))}
                  <Anchor component={Link} href="/alerts" size="xs">
                    All alerts
                  </Anchor>
                </Stack>
              </Card>
            )}
          </Stack>
        </Grid.Col>
      </Grid>
    </>
  );
}

Show.layout = appLayout;
