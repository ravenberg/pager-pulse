import {
  Anchor,
  Badge,
  Button,
  Card,
  Center,
  Divider,
  Grid,
  Group,
  Loader,
  Paper,
  Select,
  Stack,
  Switch,
  Tabs,
  Text,
  Textarea,
  TextInput,
  ThemeIcon,
  Timeline,
  Title,
  Tooltip,
  UnstyledButton,
} from '@mantine/core';
import {
  IconArrowsExchange,
  IconCheck,
  IconChecklist,
  IconChevronRight,
  IconClock,
  IconFlame,
  IconLock,
  IconNotebook,
  IconMessage,
  IconSpeakerphone,
  IconUserStar,
  IconWorld,
} from '@tabler/icons-react';
import { Head, Link, router, useForm, usePoll } from 'nestjs-mvc/react';
import { Fragment, type FormEvent, type ReactNode } from 'react';
import { AlertStatusBadge, SeverityBadge } from '../../components/Badges';
import { FollowUpItem } from '../../components/FollowUpItem';
import { capitalize, dateTime, duration, relative } from '../../lib/format';
import { STATUS_COLOR } from '../../lib/theme';
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
  kind:
    | 'declared'
    | 'update'
    | 'status'
    | 'severity'
    | 'lead'
    | 'follow_up'
    | 'post_mortem';
  body: string;
  isPublic: boolean;
  author: Person | null;
  createdAt: string;
}

type Tab = 'updates' | 'timeline' | 'followUps' | 'alerts';

interface Props {
  tab: Tab;
  incident: IncidentRow & {
    summary: string;
    isPublic: boolean;
    reporter: Person | null;
    postMortem: { status: PostMortemStatus; publishedAt: string | null } | null;
  };
  counts: Record<Tab, number>;
  // Only the active tab's list arrives with the page; the others are
  // optional props, loaded when their tab is opened.
  updates?: Entry[];
  timeline?: Entry[];
  followUps?: FollowUpRow[];
  alerts?: AlertRow[];
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
  post_mortem: IconNotebook,
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

type PostMortemStatus = 'draft' | 'in_review' | 'published';

/** After resolved comes post-incident, driven by the post-mortem. */
const POST_INCIDENT = ['documenting', 'reviewing', 'closed'] as const;
const POST_INCIDENT_STEP: Record<PostMortemStatus, number> = {
  draft: 0,
  in_review: 1,
  published: 2,
};

/**
 * The lifecycle as incident.io shows it. The live steps change the status on
 * a click; once resolved, the post-incident steps follow the post-mortem and
 * lead to it.
 */
function Lifecycle({
  incidentId,
  status,
  postMortem,
  canRespond,
  onChange,
}: {
  incidentId: number;
  status: IncidentStatus;
  postMortem: PostMortemStatus | null;
  canRespond: boolean;
  onChange: (status: IncidentStatus) => void;
}) {
  const steps = [...STATUSES, ...POST_INCIDENT];
  const current =
    status === 'resolved'
      ? STATUSES.length + (postMortem ? POST_INCIDENT_STEP[postMortem] : 0)
      : STATUSES.indexOf(status);
  const color = (index: number) =>
    index >= STATUSES.length ? 'violet' : STATUS_COLOR[STATUSES[index]];

  return (
    <Paper withBorder px="xs" py={6} radius="md">
      <Group gap={4} wrap="nowrap">
        {steps.map((step, index) => {
          const live = index < STATUSES.length;
          const badge = (
            <Badge
              size="md"
              radius="sm"
              tt="none"
              fw={index === current ? 700 : 500}
              color={index <= current ? color(index) : 'gray'}
              variant={
                index === current
                  ? 'filled'
                  : index < current
                    ? 'light'
                    : 'transparent'
              }
              leftSection={
                index < current ? <IconCheck size={12} /> : undefined
              }
              style={{
                cursor:
                  live && canRespond && index !== current
                    ? 'pointer'
                    : undefined,
              }}
            >
              {capitalize(step)}
            </Badge>
          );
          return (
            <Fragment key={step}>
              {index > 0 && (
                <IconChevronRight
                  size={14}
                  color="var(--mantine-color-dimmed)"
                />
              )}
              {live ? (
                <UnstyledButton
                  disabled={!canRespond || index === current}
                  onClick={() => onChange(step as IncidentStatus)}
                  aria-label={`Move to ${step}`}
                >
                  {badge}
                </UnstyledButton>
              ) : status === 'resolved' ? (
                <Link
                  href={`/incidents/${incidentId}/post-mortem`}
                  aria-label="Post-mortem"
                >
                  {badge}
                </Link>
              ) : (
                badge
              )}
            </Fragment>
          );
        })}
      </Group>
    </Paper>
  );
}

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
      // Its own error bag: its messages land in errors.update, so the
      // follow-up form on the same page never shows them.
      errorBag: 'update',
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
      errorBag: 'followUp',
      preserveScroll: true,
      onSuccess: () => form.reset(),
    });
  }

  return (
    <form onSubmit={submit}>
      <Group gap="xs" align="flex-start" wrap="nowrap">
        <TextInput
          size="xs"
          placeholder="Add a follow-up"
          style={{ flex: 2 }}
          value={form.data.title}
          onChange={(e) => form.setData('title', e.currentTarget.value)}
          error={form.errors.title}
        />
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
    </form>
  );
}

function Property({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Group justify="space-between" wrap="nowrap" gap="xs">
      <Text size="sm" c="dimmed">
        {label}
      </Text>
      {children}
    </Group>
  );
}

function Loading() {
  return (
    <Center py="xl">
      <Loader size="sm" />
    </Center>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return (
    <Text size="sm" c="dimmed" ta="center" py="lg">
      {children}
    </Text>
  );
}

function PublicBadge() {
  return (
    <Badge size="xs" variant="light" leftSection={<IconWorld size={10} />}>
      Public
    </Badge>
  );
}

function Updates({ updates }: { updates: Entry[] }) {
  if (!updates.length) return <Empty>No updates shared yet.</Empty>;
  return (
    <Stack gap="md">
      {updates.map((update) => (
        <div key={update.id}>
          <Group gap={6} mb={4}>
            <Text size="sm" fw={600}>
              {update.author?.name ?? 'PagerPulse'}
            </Text>
            <Tooltip label={dateTime(update.createdAt)}>
              <Text size="xs" c="dimmed">
                {relative(update.createdAt)}
              </Text>
            </Tooltip>
            {update.isPublic && <PublicBadge />}
          </Group>
          <Paper bg="var(--mantine-color-default-hover)" p="sm" radius="md">
            <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
              {update.body}
            </Text>
          </Paper>
        </div>
      ))}
    </Stack>
  );
}

function TimelineView({ entries }: { entries: Entry[] }) {
  return (
    <Timeline bulletSize={28} lineWidth={2}>
      {entries.map((entry) => {
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
                {entry.isPublic && <PublicBadge />}
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
            <Text size="xs" c="dimmed" mt={4}>
              {dateTime(entry.createdAt)}
            </Text>
          </Timeline.Item>
        );
      })}
    </Timeline>
  );
}

function Alerts({ alerts }: { alerts: AlertRow[] }) {
  if (!alerts.length)
    return <Empty>No alerts are attached to this incident.</Empty>;
  return (
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
              {alert.occurrences > 1 && ` · fired ${alert.occurrences} times`}
            </Text>
          </div>
          <AlertStatusBadge status={alert.status} size="sm" />
        </Group>
      ))}
      <Anchor component={Link} href="/alerts" size="xs">
        All alerts
      </Anchor>
    </Stack>
  );
}

export default function Show({
  tab,
  incident,
  counts,
  updates,
  timeline,
  followUps,
  alerts,
  users,
  canRespond,
}: Props) {
  // Somebody else may be working this incident: refresh the header and the
  // open tab. On the timeline, send the last id we have and get only what
  // came after it; the server marks the prop to be appended, not replaced.
  usePoll(10_000, () => {
    const last = tab === 'timeline' ? timeline?.at(-1) : undefined;
    return {
      only: ['incident', 'counts', tab],
      headers: last ? { 'X-Timeline-After': String(last.id) } : undefined,
    };
  });

  // Switching tabs is a partial reload: the URL gets ?tab=, the server
  // computes just that tab's prop, and the rest of the page stays put.
  const openTab = (next: string | null) =>
    next &&
    router.get(
      `/incidents/${incident.id}`,
      { tab: next },
      {
        only: [next, 'tab'],
        preserveState: true,
        preserveScroll: true,
        replace: true,
      },
    );

  const change = (data: Record<string, string | null>) =>
    router.patch(`/incidents/${incident.id}`, data, {
      preserveScroll: true,
      preserveState: true,
    });

  const label = (text: string, count: number) => (
    <Group gap={6} wrap="nowrap">
      {text}
      {count > 0 && (
        <Badge size="xs" variant="light" color="gray" circle={count < 10}>
          {count}
        </Badge>
      )}
    </Group>
  );

  return (
    <>
      <Head title={`${incident.reference} ${incident.title} · PagerPulse`} />
      <Anchor component={Link} href="/incidents" size="sm" c="dimmed">
        ← Incidents
      </Anchor>
      <Group mt="xs" mb="sm" gap="sm">
        <Title order={2}>
          <Text span inherit c="dimmed">
            {incident.reference}
          </Text>{' '}
          {incident.title}
        </Title>
      </Group>
      <Group mb="lg" gap="xs" data-xray="incident">
        <Lifecycle
          incidentId={incident.id}
          status={incident.status}
          postMortem={incident.postMortem?.status ?? null}
          canRespond={canRespond}
          onChange={(status) => change({ status })}
        />
        <SeverityBadge severity={incident.severity} size="lg" radius="sm" />
        {incident.isPrivate && (
          <Tooltip label="Only admins, the reporter and the lead can see it">
            <Badge
              size="lg"
              radius="sm"
              color="grape"
              variant="light"
              leftSection={<IconLock size={14} />}
            >
              Private
            </Badge>
          </Tooltip>
        )}
        <Badge
          size="lg"
          radius="sm"
          variant="default"
          tt="none"
          fw={500}
          leftSection={<IconClock size={14} />}
        >
          {incident.resolvedAt ? 'Lasted' : 'Ongoing for'}{' '}
          {duration(incident.declaredAt, incident.resolvedAt)}
        </Badge>
      </Group>

      <Grid gap="lg">
        <Grid.Col span={{ base: 12, md: 8 }}>
          <Stack>
            {incident.summary && (
              <Card withBorder padding="md">
                <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
                  {incident.summary}
                </Text>
              </Card>
            )}
            {canRespond && (
              <PostUpdate key={incident.status} incident={incident} />
            )}
            <Card withBorder padding="lg" data-xray={tab}>
              <Tabs value={tab} onChange={openTab} keepMounted={false}>
                <Tabs.List mb="md">
                  <Tabs.Tab value="updates">
                    {label('Updates', counts.updates)}
                  </Tabs.Tab>
                  <Tabs.Tab value="timeline">
                    {label('Timeline', counts.timeline)}
                  </Tabs.Tab>
                  <Tabs.Tab value="followUps">
                    {label('Follow-ups', counts.followUps)}
                  </Tabs.Tab>
                  <Tabs.Tab value="alerts">
                    {label('Alerts', counts.alerts)}
                  </Tabs.Tab>
                </Tabs.List>

                <Tabs.Panel value="updates">
                  {updates ? <Updates updates={updates} /> : <Loading />}
                </Tabs.Panel>
                <Tabs.Panel value="timeline">
                  {timeline ? <TimelineView entries={timeline} /> : <Loading />}
                </Tabs.Panel>
                <Tabs.Panel value="followUps">
                  {followUps ? (
                    <Stack gap="sm">
                      {followUps.length === 0 && (
                        <Empty>No follow-ups yet.</Empty>
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
                  ) : (
                    <Loading />
                  )}
                </Tabs.Panel>
                <Tabs.Panel value="alerts">
                  {alerts ? <Alerts alerts={alerts} /> : <Loading />}
                </Tabs.Panel>
              </Tabs>
            </Card>
          </Stack>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 4 }}>
          <Card withBorder padding="lg" data-xray="users">
            <Stack gap="sm">
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
              {incident.resolvedAt && (
                <Property label="Resolved">
                  <Text size="sm">{dateTime(incident.resolvedAt)}</Text>
                </Property>
              )}
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
              <Property label="Post-mortem">
                {incident.status === 'resolved' || incident.postMortem ? (
                  <Anchor
                    component={Link}
                    href={`/incidents/${incident.id}/post-mortem`}
                    size="sm"
                  >
                    {incident.postMortem
                      ? capitalize(incident.postMortem.status)
                      : 'Write it'}
                  </Anchor>
                ) : (
                  <Text size="sm" c="dimmed">
                    After it is resolved
                  </Text>
                )}
              </Property>
              <Property label="Status page">
                {incident.isPrivate ? (
                  <Text size="sm">Private</Text>
                ) : incident.isPublic ? (
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
        </Grid.Col>
      </Grid>
    </>
  );
}

Show.layout = appLayout;
