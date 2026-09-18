import {
  ActionIcon,
  Anchor,
  Badge,
  Button,
  Card,
  Code,
  Group,
  SimpleGrid,
  Table,
  Text,
  Tooltip,
} from '@mantine/core';
import {
  IconCheck,
  IconEye,
  IconFlame,
  IconPlugConnected,
} from '@tabler/icons-react';
import { Link, router, usePoll } from 'nestjs-mvc/react';
import { useRef } from 'react';
import { AlertStatusBadge, SeverityBadge } from '../../components/Badges';
import { PageHeader } from '../../components/PageHeader';
import { relative } from '../../lib/format';
import { appLayout } from '../../layouts/AppLayout';
import type { AlertRow } from '../../types';

interface Props {
  cursor: string;
  counts: { firing: number; acknowledged: number; resolved: number };
  alerts: AlertRow[];
  /** The latest copy of every alert that changed while the page was open. */
  changes: Record<string, AlertRow>;
  canRespond: boolean;
  canManage: boolean;
}

function Count({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <Card withBorder padding="md">
      <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
        {label}
      </Text>
      <Text fz={28} fw={700} c={value > 0 ? color : undefined}>
        {value}
      </Text>
    </Card>
  );
}

/** Rows that arrive after the page loaded, so they can be shown as new. */
function useArrivals(alerts: AlertRow[]) {
  const seen = useRef<Set<number> | null>(null);
  seen.current ??= new Set(alerts.map((alert) => alert.id));
  const fresh = new Set(
    alerts.filter((a) => !seen.current!.has(a.id)).map((a) => a.id),
  );
  return fresh;
}

export default function Index({
  cursor,
  counts,
  alerts,
  changes,
  canRespond,
  canManage,
}: Props) {
  // Every 5 seconds, only the difference since the cursor of the last answer:
  // new alerts go on top of `alerts` (prepend), changed ones are merged into
  // `changes` (deepMerge) and shown where they already are.
  usePoll(5000, () => ({
    only: ['alerts', 'changes', 'counts', 'cursor', 'openAlerts'],
    headers: { 'X-Alerts-Since': cursor },
  }));
  const fresh = useArrivals(alerts);
  const rows = alerts.map((alert) => changes[alert.id] ?? alert);

  const act = (alert: AlertRow, action: string) =>
    router.post(`/alerts/${alert.id}/${action}`, {}, { preserveScroll: true });

  return (
    <>
      <PageHeader
        title="Alerts"
        description="What the monitoring tools are saying. New alerts show up on their own."
        actions={
          canManage && (
            <Button
              component={Link}
              href="/alerts/sources"
              variant="default"
              leftSection={<IconPlugConnected size={16} />}
            >
              Sources
            </Button>
          )
        }
      />

      <SimpleGrid cols={{ base: 3 }} mb="lg" data-xray="counts">
        <Count label="Firing" value={counts.firing} color="red" />
        <Count
          label="Acknowledged"
          value={counts.acknowledged}
          color="orange"
        />
        <Count label="Resolved · 24h" value={counts.resolved} color="green" />
      </SimpleGrid>

      <Card withBorder padding={0} data-xray="alerts">
        <Table verticalSpacing="sm" horizontalSpacing="md">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Alert</Table.Th>
              <Table.Th>Severity</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th visibleFrom="md">Incident</Table.Th>
              {canRespond && <Table.Th />}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.map((alert) => (
              <Table.Tr
                key={alert.id}
                className={fresh.has(alert.id) ? 'alert-arrived' : undefined}
                opacity={alert.status === 'resolved' ? 0.6 : 1}
              >
                <Table.Td>
                  <Group gap={6} wrap="nowrap">
                    <Text fw={600} size="sm">
                      {alert.title}
                    </Text>
                    {alert.occurrences > 1 && (
                      <Tooltip label={`Fired ${alert.occurrences} times`}>
                        <Badge size="xs" variant="light" color="gray">
                          ×{alert.occurrences}
                        </Badge>
                      </Tooltip>
                    )}
                  </Group>
                  <Text size="xs" c="dimmed">
                    {alert.source.name} · {relative(alert.firstSeenAt)}
                    {alert.occurrences > 1 &&
                      ` · last ${relative(alert.lastSeenAt)}`}
                    {alert.acknowledgedBy &&
                      ` · acknowledged by ${alert.acknowledgedBy.name}`}
                  </Text>
                  {Object.keys(alert.labels).length > 0 && (
                    <Group gap={4} mt={4}>
                      {Object.entries(alert.labels).map(([key, value]) => (
                        <Code key={key} fz="xs">
                          {key}={value}
                        </Code>
                      ))}
                    </Group>
                  )}
                </Table.Td>
                <Table.Td>
                  <SeverityBadge severity={alert.severity} />
                </Table.Td>
                <Table.Td>
                  <AlertStatusBadge status={alert.status} />
                </Table.Td>
                <Table.Td visibleFrom="md">
                  {alert.incident ? (
                    <Anchor
                      component={Link}
                      href={`/incidents/${alert.incident.id}`}
                      size="sm"
                    >
                      {alert.incident.reference}
                    </Anchor>
                  ) : canRespond && alert.status !== 'resolved' ? (
                    <Button
                      size="compact-xs"
                      variant="light"
                      leftSection={<IconFlame size={14} />}
                      onClick={() => act(alert, 'declare')}
                    >
                      Declare incident
                    </Button>
                  ) : (
                    <Text size="sm" c="dimmed">
                      —
                    </Text>
                  )}
                </Table.Td>
                {canRespond && (
                  <Table.Td>
                    <Group gap={4} justify="flex-end" wrap="nowrap">
                      {alert.status === 'firing' && (
                        <Tooltip label="Acknowledge">
                          <ActionIcon
                            variant="subtle"
                            color="orange"
                            aria-label="Acknowledge"
                            onClick={() => act(alert, 'acknowledge')}
                          >
                            <IconEye size={16} />
                          </ActionIcon>
                        </Tooltip>
                      )}
                      {alert.status !== 'resolved' && (
                        <Tooltip label="Resolve">
                          <ActionIcon
                            variant="subtle"
                            color="green"
                            aria-label="Resolve"
                            onClick={() => act(alert, 'resolve')}
                          >
                            <IconCheck size={16} />
                          </ActionIcon>
                        </Tooltip>
                      )}
                    </Group>
                  </Table.Td>
                )}
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
        {alerts.length === 0 && (
          <Text c="dimmed" ta="center" p="xl">
            No alerts yet.{' '}
            {canManage && (
              <>
                Connect a tool under{' '}
                <Anchor component={Link} href="/alerts/sources">
                  Sources
                </Anchor>
                .
              </>
            )}
          </Text>
        )}
      </Card>
      <Text size="xs" c="dimmed" mt="xs">
        Newest first · the latest 50, plus whatever arrives while you watch.
      </Text>
    </>
  );
}

Index.layout = appLayout;
