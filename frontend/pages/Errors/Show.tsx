import { Button, Center, Stack, Text, Title } from '@mantine/core';
import { Head, Link } from 'nestjs-mvc/react';
import { appLayout } from '../../layouts/AppLayout';

const TITLES: Record<number, string> = {
  403: 'Not for you',
  404: 'Nothing here',
  500: 'Something broke',
  503: 'Back soon',
};

export default function Show({
  status,
  reason,
}: {
  status: number;
  reason?: string;
}) {
  return (
    <Center mih="60vh">
      <Head title={`${status} · PagerPulse`} />
      <Stack align="center" gap="xs">
        <Text fz={64} fw={800} c="dimmed">
          {status}
        </Text>
        <Title order={3}>{TITLES[status] ?? 'Error'}</Title>
        {reason && <Text c="dimmed">{reason}</Text>}
        <Button component={Link} href="/" variant="light" mt="md">
          Back to the dashboard
        </Button>
      </Stack>
    </Center>
  );
}

Show.layout = appLayout;
