import {
  ActionIcon,
  Button,
  Card,
  Checkbox,
  CloseButton,
  Group,
  Loader,
  Menu,
  Popover,
  Stack,
  SegmentedControl,
  Select,
  Table,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { useDebouncedCallback } from '@mantine/hooks';
import {
  IconBookmarkPlus,
  IconColumns3,
  IconDownload,
  IconLock,
  IconPlus,
  IconSearch,
} from '@tabler/icons-react';
import {
  InfiniteScroll,
  Link,
  router,
  useForm,
  usePage,
  useRemember,
} from 'nestjs-mvc/react';
import { type FormEvent, useState } from 'react';
import { SeverityBadge, StatusBadge } from '../../components/Badges';
import { EmptyState } from '../../components/Illustration';
import { PageHeader } from '../../components/PageHeader';
import { duration, relative } from '../../lib/format';
import { appLayout } from '../../layouts/AppLayout';
import type { IncidentRow, SharedProps } from '../../types';

interface Filters {
  state: string;
  severity: string;
  search: string;
}

type Column = 'severity' | 'status' | 'lead' | 'services' | 'duration';

const COLUMNS: { key: Column; label: string }[] = [
  { key: 'severity', label: 'Severity' },
  { key: 'status', label: 'Status' },
  { key: 'lead', label: 'Lead' },
  { key: 'services', label: 'Services' },
  { key: 'duration', label: 'Duration' },
];
const DEFAULT_COLUMNS: Column[] = ['severity', 'status', 'lead', 'duration'];

interface SavedView {
  id: number;
  name: string;
  filters: Filters;
  columns: Column[];
}

interface Props {
  filters: Filters;
  views: SavedView[];
  counts: { open: number; resolved: number };
  incidents: { data: IncidentRow[]; total: number };
}

const sameFilters = (a: Filters, b: Filters) =>
  a.state === b.state && a.severity === b.severity && a.search === b.search;
const sameColumns = (a: Column[], b: Column[]) =>
  a.length === b.length && a.every((column) => b.includes(column));

/** Names what the list shows now, so it is one click away next time. */
function SaveView({
  filters,
  columns,
}: {
  filters: Filters;
  columns: Column[];
}) {
  // A remember key: a half-typed name survives opening an incident and
  // coming back with the back button, and the popover opens with it.
  const form = useForm('Incidents/SaveView', { name: '' });
  const [opened, setOpened] = useState(() => !!form.data.name);

  function submit(event: FormEvent) {
    event.preventDefault();
    form.transform((data) => ({ ...data, filters, columns }));
    form.post('/incidents/views', {
      errorBag: 'saveView',
      // The redirect back only needs to bring the views along, and the
      // errors: named, because an always() object (errors is one) comes back
      // empty from a partial reload that doesn't name it.
      only: ['views', 'errors'],
      preserveScroll: true,
      preserveState: true,
      onSuccess: () => {
        form.reset();
        setOpened(false);
      },
    });
  }

  return (
    <Popover
      opened={opened}
      onChange={setOpened}
      position="bottom-start"
      width={260}
      trapFocus
    >
      <Popover.Target>
        <Button
          size="xs"
          variant="subtle"
          color="gray"
          leftSection={<IconBookmarkPlus size={14} />}
          onClick={() => setOpened((o) => !o)}
        >
          Save view
        </Button>
      </Popover.Target>
      <Popover.Dropdown>
        <form onSubmit={submit}>
          <Stack gap="xs">
            <TextInput
              size="xs"
              label="Name"
              placeholder="Critical this week"
              data-autofocus
              value={form.data.name}
              onChange={(e) => form.setData('name', e.currentTarget.value)}
              error={form.errors.name}
            />
            <Group justify="flex-end" gap="xs">
              <Button
                size="xs"
                variant="default"
                onClick={() => {
                  form.reset();
                  form.clearErrors();
                  setOpened(false);
                }}
              >
                Cancel
              </Button>
              <Button size="xs" type="submit" loading={form.processing}>
                Save
              </Button>
            </Group>
          </Stack>
        </form>
      </Popover.Dropdown>
    </Popover>
  );
}

export default function Index({ filters, views, counts, incidents }: Props) {
  const { props } = usePage<SharedProps>();
  const [search, setSearch] = useState(filters.search);
  // Which columns show is not in the URL and not on the server: it lives in
  // this history entry. Open an incident, press back: still the same columns.
  const [columns, setColumns] = useRemember<Column[]>(
    DEFAULT_COLUMNS,
    'Incidents/columns',
  );
  const shows = (column: Column) => columns.includes(column);
  const current = views.find(
    (view) =>
      sameFilters(view.filters, filters) && sameColumns(view.columns, columns),
  );

  // A partial reload of the same controller with new query parameters. `reset`
  // makes InfiniteScroll start over instead of appending to the old list.
  function apply(next: Partial<Filters>) {
    const params = Object.fromEntries(
      Object.entries({ ...filters, ...next }).filter(([, value]) => value),
    );
    router.get('/incidents', params, {
      only: ['incidents', 'filters'],
      reset: ['incidents'],
      preserveState: true,
      preserveScroll: true,
      replace: true,
    });
  }
  function open(view: SavedView) {
    setColumns(view.columns);
    setSearch(view.filters.search);
    apply(view.filters);
  }

  const applySearch = useDebouncedCallback(
    (value: string) => apply({ search: value }),
    250,
  );

  return (
    <>
      <PageHeader
        title="Incidents"
        description={`${counts.open} open · ${counts.resolved} resolved`}
        actions={
          <Group gap="xs">
            {/* A plain link: the browser downloads the file. */}
            <Button
              component="a"
              href={`/incidents/export?${new URLSearchParams(
                Object.entries(filters).filter(([, value]) => value),
              )}`}
              variant="default"
              leftSection={<IconDownload size={16} />}
            >
              Export CSV
            </Button>
            {props.auth.user?.role !== 'viewer' && (
              <Button
                component={Link}
                href="/incidents/create"
                leftSection={<IconPlus size={16} />}
              >
                Declare incident
              </Button>
            )}
          </Group>
        }
      />

      <Group mb="md" gap="sm">
        <SegmentedControl
          value={filters.state}
          onChange={(state) => apply({ state })}
          data={[
            { value: 'open', label: 'Open' },
            { value: 'resolved', label: 'Resolved' },
            { value: 'all', label: 'All' },
          ]}
        />
        <Select
          placeholder="Any severity"
          clearable
          value={filters.severity || null}
          onChange={(severity) => apply({ severity: severity ?? '' })}
          data={[
            { value: 'critical', label: 'Critical' },
            { value: 'major', label: 'Major' },
            { value: 'minor', label: 'Minor' },
          ]}
          w={160}
        />
        <TextInput
          placeholder="Search title or INC-12"
          leftSection={<IconSearch size={16} />}
          value={search}
          onChange={(e) => {
            setSearch(e.currentTarget.value);
            applySearch(e.currentTarget.value);
          }}
          style={{ flex: 1, minWidth: 200 }}
        />
        <Menu position="bottom-end" closeOnItemClick={false}>
          <Menu.Target>
            <ActionIcon
              variant="default"
              size="lg"
              aria-label="Columns"
              title="Columns"
            >
              <IconColumns3 size={16} />
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Label>Columns</Menu.Label>
            {COLUMNS.map(({ key, label }) => (
              <Menu.Item key={key}>
                <Checkbox
                  size="xs"
                  label={label}
                  checked={shows(key)}
                  onChange={(e) =>
                    setColumns(
                      e.currentTarget.checked
                        ? COLUMNS.map((c) => c.key).filter(
                            (c) => c === key || columns.includes(c),
                          )
                        : columns.filter((c) => c !== key),
                    )
                  }
                />
              </Menu.Item>
            ))}
          </Menu.Dropdown>
        </Menu>
      </Group>

      <Group mb="md" gap={6} data-xray="views">
        <Text size="xs" c="dimmed" mr={4}>
          Views
        </Text>
        {views.map((view) => (
          <Button.Group key={view.id}>
            <Button
              size="xs"
              variant={view === current ? 'light' : 'default'}
              onClick={() => open(view)}
            >
              {view.name}
            </Button>
            <Button
              size="xs"
              variant={view === current ? 'light' : 'default'}
              px={4}
              aria-label={`Remove view ${view.name}`}
              onClick={() =>
                router.delete(`/incidents/views/${view.id}`, {
                  only: ['views'],
                  preserveScroll: true,
                  preserveState: true,
                })
              }
            >
              <CloseButton component="span" size="xs" variant="transparent" />
            </Button>
          </Button.Group>
        ))}
        {!current && <SaveView filters={filters} columns={columns} />}
      </Group>

      <Card withBorder padding={0} data-xray="incidents">
        <InfiniteScroll
          data="incidents"
          buffer={300}
          loading={
            <Group justify="center" p="md">
              <Loader size="sm" />
            </Group>
          }
        >
          <Table highlightOnHover verticalSpacing="sm" horizontalSpacing="md">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Incident</Table.Th>
                {shows('severity') && <Table.Th>Severity</Table.Th>}
                {shows('status') && <Table.Th>Status</Table.Th>}
                {shows('lead') && <Table.Th visibleFrom="md">Lead</Table.Th>}
                {shows('services') && (
                  <Table.Th visibleFrom="md">Services</Table.Th>
                )}
                {shows('duration') && (
                  <Table.Th visibleFrom="md">Duration</Table.Th>
                )}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {incidents.data.map((incident) => (
                <Table.Tr
                  key={incident.id}
                  style={{ cursor: 'pointer' }}
                  onClick={() => router.visit(`/incidents/${incident.id}`)}
                >
                  <Table.Td>
                    <Group gap={6} wrap="nowrap">
                      {incident.isPrivate && (
                        <Tooltip label="Private">
                          <IconLock
                            size={14}
                            color="var(--mantine-color-grape-6)"
                          />
                        </Tooltip>
                      )}
                      <Text
                        fw={600}
                        size="sm"
                        component={Link}
                        href={`/incidents/${incident.id}`}
                        // Fetched on hover, so the click shows it at once.
                        prefetch
                      >
                        {incident.title}
                      </Text>
                    </Group>
                    <Text size="xs" c="dimmed">
                      {incident.reference} · {relative(incident.declaredAt)}
                      {!shows('services') &&
                        incident.services.length > 0 &&
                        ` · ${incident.services.join(', ')}`}
                    </Text>
                  </Table.Td>
                  {shows('severity') && (
                    <Table.Td>
                      <SeverityBadge severity={incident.severity} />
                    </Table.Td>
                  )}
                  {shows('status') && (
                    <Table.Td>
                      <StatusBadge status={incident.status} />
                    </Table.Td>
                  )}
                  {shows('lead') && (
                    <Table.Td visibleFrom="md">
                      <Text size="sm">{incident.lead?.name ?? '—'}</Text>
                    </Table.Td>
                  )}
                  {shows('services') && (
                    <Table.Td visibleFrom="md">
                      <Text size="sm">
                        {incident.services.join(', ') || '—'}
                      </Text>
                    </Table.Td>
                  )}
                  {shows('duration') && (
                    <Table.Td visibleFrom="md">
                      <Text size="sm" c="dimmed">
                        {duration(incident.declaredAt, incident.resolvedAt)}
                      </Text>
                    </Table.Td>
                  )}
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
          {incidents.data.length === 0 && (
            <EmptyState illustration="the-void" title="No incidents match">
              Try another state, severity or search.
            </EmptyState>
          )}
        </InfiniteScroll>
      </Card>
    </>
  );
}

Index.layout = appLayout;
