import { Anchor, Stack, Text } from '@mantine/core';
import { Head, Link } from 'nestjs-mvc/react';
import { type PublicIncident } from '../../components/status';
import { dateTime, duration } from '../../lib/format';
import { statusLayout } from '../../layouts/StatusLayout';
import { IncidentCard } from './Show';

export default function Incident({ incident }: { incident: PublicIncident }) {
  return (
    <Stack>
      <Head title={`${incident.title} · PagerPulse status`}>
        <meta
          name="description"
          content={incident.updates[0]?.body ?? incident.title}
        />
      </Head>
      <Anchor component={Link} href="/status" size="sm" c="dimmed">
        ← Current status
      </Anchor>
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
