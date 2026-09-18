import { Anchor, Card, Group, Stack, Text, Title } from '@mantine/core';
import { Head, Link } from 'nestjs-mvc/react';
import { type PublicIncident } from '../../components/status';
import { dateTime, duration } from '../../lib/format';
import { statusLayout } from '../../layouts/StatusLayout';
import { IncidentCard } from './Show';

interface WriteUp {
  summary: string;
  impact: string;
  rootCause: string;
  lessons: string;
  publishedAt: string | null;
}

const SECTIONS: [keyof WriteUp, string][] = [
  ['summary', 'What happened'],
  ['impact', 'Who was affected'],
  ['rootCause', 'Why it happened'],
  ['lessons', 'What we are changing'],
];

export default function Incident({
  incident,
  internalUrl,
  writeUp,
}: {
  incident: PublicIncident;
  /** Only for teammates who are logged in. */
  internalUrl: string | null;
  writeUp: WriteUp | null;
}) {
  return (
    <Stack>
      <Head title={`${incident.title} · PagerPulse status`}>
        <meta
          name="description"
          content={incident.updates[0]?.body ?? incident.title}
        />
      </Head>
      <Group justify="space-between">
        <Anchor component={Link} href="/status" size="sm" c="dimmed">
          ← Current status
        </Anchor>
        {internalUrl && (
          <Anchor component={Link} href={internalUrl} size="sm">
            Open in PagerPulse →
          </Anchor>
        )}
      </Group>
      {writeUp && (
        <Card withBorder padding="lg" radius="lg" data-xray="writeUp">
          <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
            Write-up
            {writeUp.publishedAt && ` · ${dateTime(writeUp.publishedAt)}`}
          </Text>
          <Title order={3} mb="md">
            {incident.title}
          </Title>
          <Stack gap="md">
            {SECTIONS.filter(([key]) => writeUp[key]).map(([key, label]) => (
              <div key={key}>
                <Text fw={600} size="sm">
                  {label}
                </Text>
                <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
                  {writeUp[key]}
                </Text>
              </div>
            ))}
          </Stack>
        </Card>
      )}
      <IncidentCard incident={incident} link={false} />
      <Text size="sm" c="dimmed">
        Started {dateTime(incident.declaredAt)}
        {incident.resolvedAt &&
          `, resolved after ${duration(incident.declaredAt, incident.resolvedAt)}`}
        .
      </Text>
    </Stack>
  );
}

Incident.layout = statusLayout;
