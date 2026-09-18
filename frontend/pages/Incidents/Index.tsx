import {
  Button,
  Card,
  Group,
  Loader,
  SegmentedControl,
  Select,
  Table,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { useDebouncedCallback } from '@mantine/hooks';
import {
  IconDownload,
  IconLock,
  IconPlus,
  IconSearch,
} from '@tabler/icons-react';
import { InfiniteScroll, Link, router, usePage } from 'nestjs-mvc/react';
import { useState } from 'react';
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

interface Props {
  filters: Filters;
  counts: { open: number; resolved: number };
  incidents: { data: IncidentRow[]; total: number };
}

export default function Index({ filters, counts, incidents }: Props) {
  const { props } = usePage<SharedProps>();
  const [search, setSearch] = useState(filters.search);

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
                <Table.Th>Severity</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th visibleFrom="md">Lead</Table.Th>
                <Table.Th visibleFrom="md">Duration</Table.Th>
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
                      {incident.services.length > 0 &&
                        ` · ${incident.services.join(', ')}`}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <SeverityBadge severity={incident.severity} />
                  </Table.Td>
                  <Table.Td>
                    <StatusBadge status={incident.status} />
                  </Table.Td>
                  <Table.Td visibleFrom="md">
                    <Text size="sm">{incident.lead?.name ?? '—'}</Text>
                  </Table.Td>
                  <Table.Td visibleFrom="md">
                    <Text size="sm" c="dimmed">
                      {duration(incident.declaredAt, incident.resolvedAt)}
                    </Text>
                  </Table.Td>
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
