import {
  Anchor,
  Box,
  Card,
  Group,
  SimpleGrid,
  Text,
  Title,
  Tooltip,
} from '@mantine/core';
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import { Link } from 'nestjs-mvc/react';
import { SERVICE_STATUS, type ServiceStatus } from './status';

export interface Calendar {
  month: string;
  previous: string;
  next: string | null;
  days: {
    date: string;
    future: boolean;
    status: ServiceStatus;
    incidents: { id: number; title: string }[];
  }[];
}

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/** Links that swap only the calendar in, and still work without JavaScript. */
function MonthLink({
  month,
  label,
  children,
}: {
  month: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Anchor
      component={Link}
      href={`/status?month=${month}`}
      only={['calendar']}
      preserveState
      preserveScroll
      aria-label={label}
      c="dimmed"
      display="flex"
    >
      {children}
    </Anchor>
  );
}

/** incident.io's calendar: a month, each day coloured by its worst incident. */
export function StatusCalendar({ calendar }: { calendar: Calendar }) {
  const first = new Date(calendar.days[0].date);
  const offset = (first.getDay() + 6) % 7;
  const title = first.toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
  });
  const quiet = calendar.days.every((day) => day.incidents.length === 0);

  return (
    <Card withBorder padding="lg" radius="lg" data-xray="calendar">
      <Group justify="space-between" mb="md">
        <Title order={4}>Calendar</Title>
        <Group gap="xs">
          <MonthLink month={calendar.previous} label="Previous month">
            <IconChevronLeft size={16} />
          </MonthLink>
          <Text size="sm" w={120} ta="center">
            {title}
          </Text>
          {calendar.next ? (
            <MonthLink month={calendar.next} label="Next month">
              <IconChevronRight size={16} />
            </MonthLink>
          ) : (
            <Box w={16} />
          )}
        </Group>
      </Group>
      <SimpleGrid cols={7} spacing={6} verticalSpacing={6}>
        {WEEKDAYS.map((day, i) => (
          <Text key={i} size="xs" c="dimmed" ta="center">
            {day}
          </Text>
        ))}
        {Array.from({ length: offset }, (_, i) => (
          <div key={`pad-${i}`} />
        ))}
        {calendar.days.map((day) => {
          const color = SERVICE_STATUS[day.status].color;
          const cell = (
            <Box
              h={38}
              style={{
                borderRadius: 6,
                display: 'grid',
                placeItems: 'center',
                opacity: day.future ? 0.35 : 1,
                background: day.incidents.length
                  ? `var(--mantine-color-${color}-light)`
                  : 'var(--mantine-color-default-hover)',
                border: day.incidents.length
                  ? `1px solid var(--mantine-color-${color}-5)`
                  : '1px solid transparent',
              }}
            >
              <Text size="sm" fw={day.incidents.length ? 700 : 400}>
                {new Date(day.date).getDate()}
              </Text>
            </Box>
          );
          return day.incidents.length ? (
            <Tooltip
              key={day.date}
              label={day.incidents.map((i) => i.title).join(', ')}
              multiline
              maw={260}
            >
              <Anchor
                component={Link}
                href={`/status/incidents/${day.incidents[0].id}`}
                underline="never"
                c="inherit"
              >
                {cell}
              </Anchor>
            </Tooltip>
          ) : (
            <div key={day.date}>{cell}</div>
          );
        })}
      </SimpleGrid>
      {quiet && (
        <Text size="sm" c="dimmed" ta="center" mt="md">
          No incidents this month.
        </Text>
      )}
    </Card>
  );
}
