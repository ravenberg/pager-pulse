import { Box, Group, Stack, Text, Tooltip } from '@mantine/core';
import type { ReactNode } from 'react';

/**
 * Small single-series charts in plain HTML/SVG: thin marks in one colour,
 * a recessive grid, a tooltip on every mark, values in text colours.
 */

export interface Point {
  label: string;
  value: number | null;
  /** Tooltip body; defaults to the value. */
  detail?: ReactNode;
}

/**
 * The top of the axis: twice a round step (1, 2, 2.5 or 5 × 10ⁿ), so the
 * half-way gridline sits on a round number too.
 */
const niceMax = (max: number) => {
  if (max <= 0) return 2;
  const half = max / 2;
  const power = 10 ** Math.floor(Math.log10(half));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * power >= half)! * power;
  return step * 2;
};

function Grid({ max, format }: { max: number; format: (n: number) => string }) {
  return (
    <>
      {[1, 0.5].map((f) => (
        <Box
          key={f}
          pos="absolute"
          left={0}
          right={0}
          top={`${(1 - f) * 100}%`}
          style={{
            borderTop: '1px dashed var(--mantine-color-default-border)',
          }}
        >
          <Text size="10px" c="dimmed" pos="absolute" top={-14} left={0}>
            {format(max * f)}
          </Text>
        </Box>
      ))}
      <Box
        pos="absolute"
        left={0}
        right={0}
        bottom={0}
        style={{ borderTop: '1px solid var(--mantine-color-default-border)' }}
      />
    </>
  );
}

function XLabels({ points, every }: { points: Point[]; every: number }) {
  return (
    <Group gap={2} wrap="nowrap" mt={6}>
      {points.map((p, i) => (
        <Text
          key={p.label}
          size="10px"
          c="dimmed"
          ta="center"
          style={{ flex: 1 }}
        >
          {i % every === 0 ? p.label : ''}
        </Text>
      ))}
    </Group>
  );
}

/** Columns over time: one per point, rounded at the data end, 2px apart. */
export function ColumnChart({
  points,
  format = String,
  height = 180,
}: {
  points: Point[];
  format?: (n: number) => string;
  height?: number;
}) {
  const max = niceMax(Math.max(...points.map((p) => p.value ?? 0)));
  const every = Math.ceil(points.length / 7);
  return (
    <Box pt={16}>
      <Box pos="relative" h={height}>
        <Grid max={max} format={format} />
        <Group gap={2} wrap="nowrap" align="flex-end" h="100%" pos="relative">
          {points.map((p) => (
            <Tooltip
              key={p.label}
              label={p.detail ?? `${p.label}: ${format(p.value ?? 0)}`}
            >
              {/* The hit area is the whole column, not just the bar. */}
              <Box
                h="100%"
                style={{ flex: 1, display: 'flex', alignItems: 'flex-end' }}
              >
                <Box
                  w="100%"
                  maw={28}
                  mx="auto"
                  h={`${((p.value ?? 0) / max) * 100}%`}
                  bg="var(--chart-series)"
                  style={{
                    borderRadius: '4px 4px 0 0',
                    minHeight: p.value ? 2 : 0,
                  }}
                />
              </Box>
            </Tooltip>
          ))}
        </Group>
      </Box>
      <XLabels points={points} every={every} />
    </Box>
  );
}

/** A 2px line with markers; a missing value breaks the line instead of faking zero. */
export function LineChart({
  points,
  format = String,
  height = 180,
}: {
  points: Point[];
  format?: (n: number) => string;
  height?: number;
}) {
  const max = niceMax(Math.max(...points.map((p) => p.value ?? 0)));
  const x = (i: number) => ((i + 0.5) / points.length) * 100;
  const y = (v: number) => 100 - (v / max) * 100;
  // Runs of consecutive values, each its own path.
  const runs: string[] = [];
  let run: string[] = [];
  points.forEach((p, i) => {
    if (p.value === null) {
      if (run.length) runs.push(run.join(' '));
      run = [];
    } else run.push(`${run.length ? 'L' : 'M'}${x(i)},${y(p.value)}`);
  });
  if (run.length) runs.push(run.join(' '));
  const every = Math.ceil(points.length / 7);

  return (
    <Box pt={16}>
      <Box pos="relative" h={height}>
        <Grid max={max} format={format} />
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          width="100%"
          height="100%"
          style={{ position: 'absolute', inset: 0, overflow: 'visible' }}
          aria-hidden
        >
          {runs.map((d) => (
            <path
              key={d}
              d={d}
              fill="none"
              stroke="var(--chart-series)"
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}
        </svg>
        <Group
          gap={0}
          wrap="nowrap"
          h="100%"
          pos="absolute"
          top={0}
          left={0}
          right={0}
        >
          {points.map((p) => (
            <Tooltip
              key={p.label}
              label={
                p.detail ??
                `${p.label}: ${p.value === null ? 'none resolved' : format(p.value)}`
              }
            >
              <Box h="100%" pos="relative" style={{ flex: 1 }}>
                {p.value !== null && (
                  <Box
                    pos="absolute"
                    left="50%"
                    top={`${y(p.value)}%`}
                    w={8}
                    h={8}
                    bg="var(--chart-series)"
                    style={{
                      borderRadius: '50%',
                      transform: 'translate(-50%, -50%)',
                      boxShadow: '0 0 0 2px var(--mantine-color-body)',
                    }}
                  />
                )}
              </Box>
            </Tooltip>
          ))}
        </Group>
      </Box>
      <XLabels points={points} every={every} />
    </Box>
  );
}

/** Ranked horizontal bars with the value written at the end of each. */
export function BarList({
  rows,
  format = String,
}: {
  rows: { label: string; count: number }[];
  format?: (n: number) => string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  const total = rows.reduce((sum, r) => sum + r.count, 0);
  if (!rows.length)
    return (
      <Text size="sm" c="dimmed">
        Nothing in this period.
      </Text>
    );
  return (
    <Stack gap={8}>
      {rows.map((row) => (
        <Tooltip
          key={row.label}
          label={`${row.label}: ${format(row.count)} (${Math.round((row.count / Math.max(total, 1)) * 100)}%)`}
        >
          <Group gap="sm" wrap="nowrap">
            <Text size="sm" w={130} truncate>
              {row.label}
            </Text>
            <Box style={{ flex: 1 }}>
              <Box
                h={14}
                w={`${(row.count / max) * 100}%`}
                bg="var(--chart-series)"
                style={{
                  borderRadius: '0 4px 4px 0',
                  minWidth: row.count ? 2 : 0,
                }}
              />
            </Box>
            <Text size="sm" fw={600} w={32} ta="right">
              {format(row.count)}
            </Text>
          </Group>
        </Tooltip>
      ))}
    </Stack>
  );
}
