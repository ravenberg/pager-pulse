import { Box, Group, Text, Tooltip } from '@mantine/core';
import { dateTime } from '../lib/format';
import type { Person } from '../types';

export interface Shift {
  user: Person | null;
  startsAt: string;
  endsAt: string;
  override: boolean;
}

const COLORS = ['blue', 'teal', 'grape', 'orange', 'cyan', 'pink', 'lime'];
/** The same person gets the same colour everywhere. */
export const colorOf = (user: Person | null) =>
  user ? COLORS[user.id % COLORS.length] : 'gray';

const DAY = 24 * 60 * 60 * 1000;

/**
 * Shifts as blocks on a line from `from` to `until`, like incident.io's
 * schedule view. Overrides are striped.
 */
export function ShiftBar({
  shifts,
  from,
  until,
  height = 34,
  ticks = true,
}: {
  shifts: Shift[];
  from: string;
  until: string;
  height?: number;
  ticks?: boolean;
}) {
  const start = Date.parse(from);
  const span = Date.parse(until) - start;
  const x = (iso: string) =>
    Math.min(100, Math.max(0, ((Date.parse(iso) - start) / span) * 100));
  const now = Date.now();
  const days = Math.round(span / DAY);

  return (
    <Box>
      <Box
        pos="relative"
        h={height}
        bg="var(--mantine-color-default-hover)"
        style={{ borderRadius: 6, overflow: 'hidden' }}
      >
        {shifts.map((shift) => {
          const color = colorOf(shift.user);
          return (
            <Tooltip
              key={`${shift.startsAt}-${shift.override}`}
              label={`${shift.user?.name ?? 'Nobody'}${shift.override ? ' (override)' : ''} · ${dateTime(shift.startsAt)} → ${dateTime(shift.endsAt)}`}
            >
              <Box
                pos="absolute"
                top={3}
                bottom={3}
                left={`${x(shift.startsAt)}%`}
                w={`calc(${x(shift.endsAt) - x(shift.startsAt)}% - 2px)`}
                bg={`var(--mantine-color-${color}-light)`}
                style={{
                  borderRadius: 4,
                  borderLeft: `3px solid var(--mantine-color-${color}-6)`,
                  backgroundImage: shift.override
                    ? `repeating-linear-gradient(135deg, transparent 0 6px, var(--mantine-color-${color}-2) 6px 9px)`
                    : undefined,
                  overflow: 'hidden',
                }}
              >
                <Text size="xs" px={6} lh={`${height - 6}px`} truncate>
                  {shift.user?.name ?? '—'}
                </Text>
              </Box>
            </Tooltip>
          );
        })}
        {now > start && now < start + span && (
          <Box
            pos="absolute"
            top={0}
            bottom={0}
            left={`${((now - start) / span) * 100}%`}
            w={2}
            bg="red.6"
            title="Now"
          />
        )}
      </Box>
      {ticks && days > 1 && days <= 31 && (
        <Group justify="space-between" mt={4} wrap="nowrap" gap={0}>
          {Array.from({ length: days }, (_, i) => {
            const day = new Date(start + i * DAY);
            return (
              <Text key={i} size="10px" c="dimmed" w={`${100 / days}%`}>
                {day.toLocaleDateString('en-GB', {
                  weekday: 'narrow',
                  day: 'numeric',
                })}
              </Text>
            );
          })}
        </Group>
      )}
    </Box>
  );
}
