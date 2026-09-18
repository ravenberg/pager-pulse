import {
  Anchor,
  Box,
  Card,
  Group,
  Paper,
  Stack,
  Text,
  ThemeIcon,
  Title,
  Tooltip,
} from '@mantine/core';
import { IconAlertTriangle, IconCircleCheck } from '@tabler/icons-react';
import { Head, Link } from 'nestjs-mvc/react';
import {
  type PublicIncident,
  SERVICE_STATUS,
  type ServiceStatus,
} from '../../components/status';
import { capitalize, dateTime, day } from '../../lib/format';
import { statusLayout } from '../../layouts/StatusLayout';

interface Props {
  overall: ServiceStatus;
  services: {
    id: number;
    name: string;
    description: string;
    status: ServiceStatus;
    uptime: number;
    history: { date: string; status: ServiceStatus; incidents: string[] }[];
  }[];
  active: PublicIncident[];
  past: PublicIncident[];
}

function UptimeBars({
  history,
}: {
  history: Props['services'][number]['history'];
}) {
  return (
    <Group gap={2} wrap="nowrap" mt={6}>
      {history.map((entry) => (
        <Tooltip
          key={entry.date}
          label={
            <>
              <Text size="xs" fw={600}>
                {day(entry.date)}
              </Text>
              <Text size="xs">
                {entry.incidents.length
                  ? entry.incidents.join(', ')
                  : 'No incidents'}
              </Text>
            </>
          }
        >
          <Box
            h={28}
            style={{
              flex: 1,
              borderRadius: 2,
              background: `var(--mantine-color-${SERVICE_STATUS[entry.status].color}-${entry.status === 'operational' ? 5 : 6})`,
            }}
          />
        </Tooltip>
      ))}
    </Group>
  );
}

export function IncidentCard({
  incident,
  link = true,
}: {
  incident: PublicIncident;
  link?: boolean;
}) {
  const impact = SERVICE_STATUS[incident.impact];
  return (
    <Card
      withBorder
      padding="lg"
      style={{
        borderLeft: `4px solid var(--mantine-color-${incident.resolvedAt ? 'green' : impact.color}-6)`,
      }}
    >
      <Group justify="space-between" mb="xs">
        {link ? (
          <Anchor
            component={Link}
            href={`/status/incidents/${incident.id}`}
            fw={700}
            c="inherit"
          >
            {incident.title}
          </Anchor>
        ) : (
          <Text fw={700}>{incident.title}</Text>
        )}
        <Text size="sm" c="dimmed">
          {incident.services.join(', ')}
        </Text>
      </Group>
      <Stack gap="sm">
        {(link ? incident.updates.slice(0, 1) : incident.updates).map(
          (update, index) => (
            <div key={update.id}>
              <Text size="sm">
                {index === 0 && <b>{capitalize(incident.status)} · </b>}
                {update.body}
              </Text>
              <Text size="xs" c="dimmed">
                {dateTime(update.createdAt)}
              </Text>
            </div>
          ),
        )}
      </Stack>
    </Card>
  );
}

export default function Show({ overall, services, active, past }: Props) {
  const headline = SERVICE_STATUS[overall];
  return (
    <Stack gap="xl">
      <Head title="PagerPulse status">
        <meta
          name="description"
          content={`${headline.headline}. Live status of the PagerPulse services.`}
        />
      </Head>

      <Paper
        p="xl"
        radius="lg"
        bg={`var(--mantine-color-${headline.color}-${overall === 'operational' ? 6 : 7})`}
      >
        <Group>
          <ThemeIcon size={44} radius="xl" color="white" c={headline.color}>
            {overall === 'operational' ? (
              <IconCircleCheck size={28} />
            ) : (
              <IconAlertTriangle size={26} />
            )}
          </ThemeIcon>
          <Title order={2} c="white">
            {headline.headline}
          </Title>
        </Group>
      </Paper>

      {active.length > 0 && (
        <Stack gap="sm">
          <Title order={4}>Ongoing incidents</Title>
          {active.map((incident) => (
            <IncidentCard key={incident.id} incident={incident} />
          ))}
        </Stack>
      )}

      <Card withBorder padding="lg" radius="lg" data-xray="services">
        <Stack gap="lg">
          {services.map((service) => (
            <div key={service.id}>
              <Group justify="space-between">
                <div>
                  <Text fw={600}>{service.name}</Text>
                  <Text size="xs" c="dimmed">
                    {service.description}
                  </Text>
                </div>
                <Text
                  size="sm"
                  fw={600}
                  c={SERVICE_STATUS[service.status].color}
                >
                  {SERVICE_STATUS[service.status].label}
                </Text>
              </Group>
              <UptimeBars history={service.history} />
              <Group justify="space-between" mt={4}>
                <Text size="xs" c="dimmed">
                  30 days ago
                </Text>
                <Text size="xs" c="dimmed">
                  {(service.uptime * 100).toFixed(1)}% of days without incidents
                </Text>
                <Text size="xs" c="dimmed">
                  Today
                </Text>
              </Group>
            </div>
          ))}
        </Stack>
      </Card>

      <Stack gap="sm">
        <Title order={4}>Past incidents</Title>
        {past.length === 0 && (
          <Text c="dimmed">No incidents in the last 30 days.</Text>
        )}
        {past.map((incident) => (
          <IncidentCard key={incident.id} incident={incident} />
        ))}
      </Stack>
    </Stack>
  );
}

Show.layout = statusLayout;
