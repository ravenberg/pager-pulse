import {
  ActionIcon,
  Card,
  Group,
  SegmentedControl,
  SimpleGrid,
  Skeleton,
  Table,
  Text,
  Title,
  Tooltip,
} from '@mantine/core';
import { IconChartBar, IconTable } from '@tabler/icons-react';
import { Deferred, router } from 'nestjs-mvc/react';
import { type ReactNode, useState } from 'react';
import { BarList, ColumnChart, LineChart } from './Charts';
import { capitalize } from '../lib/format';

type Row = { label: string; count: number };

export interface InsightsProps {
  days: number;
  ranges: number[];
  // Deferred: each arrives in its own request after the page paints.
  summary?: {
    total: number;
    critical: number;
    medianMinutes: number | null;
    postMortemShare: number | null;
    openFollowUps: number;
  };
  weekly?: { week: string; count: number; medianMinutes: number | null }[];
  breakdown?: { bySeverity: Row[]; byService: Row[] };
  people?: Row[];
}

const hours = (minutes: number) =>
  minutes >= 120 ? `${Math.round(minutes / 60)}h` : `${Math.round(minutes)}m`;
const weekLabel = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

function Tile({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
}) {
  return (
    <Card withBorder padding="md">
      <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
        {label}
      </Text>
      <Text fz={28} fw={700}>
        {value}
      </Text>
      {hint && (
        <Text size="xs" c="dimmed">
          {hint}
        </Text>
      )}
    </Card>
  );
}

/** A chart with a table view of the same numbers, one click away. */
function ChartCard({
  title,
  description,
  rows,
  children,
  xray,
}: {
  title: string;
  description?: string;
  rows: [string, string][] | undefined;
  children: ReactNode;
  xray: string;
}) {
  const [table, setTable] = useState(false);
  return (
    <Card withBorder padding="lg" data-xray={xray}>
      <Group justify="space-between" align="flex-start" mb="sm">
        <div>
          <Title order={5}>{title}</Title>
          {description && (
            <Text size="xs" c="dimmed">
              {description}
            </Text>
          )}
        </div>
        <Tooltip label={table ? 'Show chart' : 'Show table'}>
          <ActionIcon
            variant="subtle"
            color="gray"
            aria-label={table ? 'Show chart' : 'Show table'}
            onClick={() => setTable((t) => !t)}
            disabled={!rows}
          >
            {table ? <IconChartBar size={16} /> : <IconTable size={16} />}
          </ActionIcon>
        </Tooltip>
      </Group>
      {!rows ? (
        <Skeleton h={180} />
      ) : table ? (
        <Table fz="sm" verticalSpacing={4}>
          <Table.Tbody>
            {rows.map(([label, value]) => (
              <Table.Tr key={label}>
                <Table.Td>{label}</Table.Td>
                <Table.Td ta="right">{value}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      ) : (
        children
      )}
    </Card>
  );
}

/**
 * How it's going: numbers and charts over a period. Each block is a deferred
 * prop; changing the period reloads just these props, asked for by name.
 */
export function InsightsSection({
  days,
  ranges,
  summary,
  weekly,
  breakdown,
  people,
}: InsightsProps) {
  const pick = (value: string) =>
    router.reload({
      data: { days: value },
      only: ['days', 'summary', 'weekly', 'breakdown', 'people'],
    });

  return (
    <>
      <Group justify="space-between" mt="xl" mb="md">
        <div>
          <Title order={4}>How it's going</Title>
          <Text size="sm" c="dimmed">
            Incidents you can see, over the last {days} days.
          </Text>
        </div>
        <SegmentedControl
          value={String(days)}
          onChange={pick}
          data={ranges.map((d) => ({ value: String(d), label: `${d} days` }))}
        />
      </Group>

      <Deferred
        data="summary"
        fallback={
          <SimpleGrid cols={{ base: 2, md: 4 }} mb="lg">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} h={96} radius="md" />
            ))}
          </SimpleGrid>
        }
      >
        {summary && (
          <SimpleGrid cols={{ base: 2, md: 4 }} mb="lg" data-xray="summary">
            <Tile
              label="Incidents"
              value={summary.total}
              hint={`${summary.critical} critical`}
            />
            <Tile
              label="Median time to resolve"
              value={
                summary.medianMinutes === null
                  ? '—'
                  : hours(summary.medianMinutes)
              }
            />
            <Tile
              label="With a published post-mortem"
              value={
                summary.postMortemShare === null
                  ? '—'
                  : `${Math.round(summary.postMortemShare * 100)}%`
              }
              hint="of resolved incidents"
            />
            <Tile label="Open follow-ups" value={summary.openFollowUps} />
          </SimpleGrid>
        )}
      </Deferred>

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg" mb="lg">
        <ChartCard
          title="Incidents per week"
          xray="weekly"
          rows={weekly?.map((w) => [weekLabel(w.week), String(w.count)])}
        >
          {weekly && (
            <ColumnChart
              points={weekly.map((w) => ({
                label: weekLabel(w.week),
                value: w.count,
                detail: `Week of ${weekLabel(w.week)}: ${w.count} incident${w.count === 1 ? '' : 's'}`,
              }))}
              format={(n) => String(Math.round(n))}
            />
          )}
        </ChartCard>
        <ChartCard
          title="Median time to resolve"
          description="Per week the incidents started in"
          xray="weekly"
          rows={weekly?.map((w) => [
            weekLabel(w.week),
            w.medianMinutes === null ? '—' : hours(w.medianMinutes),
          ])}
        >
          {weekly && (
            <LineChart
              points={weekly.map((w) => ({
                label: weekLabel(w.week),
                // Plotted in hours, so the axis steps are round hours.
                value: w.medianMinutes === null ? null : w.medianMinutes / 60,
                detail:
                  w.medianMinutes === null
                    ? `Week of ${weekLabel(w.week)}: none resolved yet`
                    : `Week of ${weekLabel(w.week)}: ${hours(w.medianMinutes)}`,
              }))}
              format={(h) => `${+h.toFixed(1)}h`}
            />
          )}
        </ChartCard>
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, md: 3 }} spacing="lg">
        <ChartCard
          title="By severity"
          xray="breakdown"
          rows={breakdown?.bySeverity.map((r) => [
            capitalize(r.label),
            String(r.count),
          ])}
        >
          {breakdown && (
            <BarList
              rows={breakdown.bySeverity.map((r) => ({
                ...r,
                label: capitalize(r.label),
              }))}
            />
          )}
        </ChartCard>
        <ChartCard
          title="By service"
          description="An incident can affect several"
          xray="breakdown"
          rows={breakdown?.byService.map((r) => [r.label, String(r.count)])}
        >
          {breakdown && <BarList rows={breakdown.byService} />}
        </ChartCard>
        <ChartCard
          title="Incidents led"
          description="Who ends up holding them"
          xray="people"
          rows={people?.map((r) => [r.label, String(r.count)])}
        >
          {people && <BarList rows={people} />}
        </ChartCard>
      </SimpleGrid>
    </>
  );
}
