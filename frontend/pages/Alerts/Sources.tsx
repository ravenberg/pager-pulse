import {
  ActionIcon,
  Anchor,
  Badge,
  Button,
  Card,
  Code,
  CopyButton,
  Group,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core';
import {
  IconCheck,
  IconCopy,
  IconRefresh,
  IconTrash,
} from '@tabler/icons-react';
import { Link, router, useForm } from 'nestjs-mvc/react';
import type { FormEvent } from 'react';
import { PageHeader } from '../../components/PageHeader';
import { relative } from '../../lib/format';
import { appLayout } from '../../layouts/AppLayout';

interface Source {
  id: number;
  name: string;
  token: string;
  service: string | null;
  alerts: number;
  lastAlertAt: string | null;
}

interface Props {
  ingestUrl: string;
  sources: Source[];
  services: { id: number; name: string }[];
}

function Copy({ value, label }: { value: string; label: string }) {
  return (
    <CopyButton value={value}>
      {({ copied, copy }) => (
        <Tooltip label={copied ? 'Copied' : label}>
          <ActionIcon variant="subtle" color="gray" onClick={copy}>
            {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
          </ActionIcon>
        </Tooltip>
      )}
    </CopyButton>
  );
}

const curl = (url: string, token: string) =>
  `curl -X POST ${url} \\
  -H "Authorization: Bearer ${token}" \\
  -H "Content-Type: application/json" \\
  -d '{"title":"High error rate","severity":"critical","dedupKey":"api-5xx"}'`;

function NewSource({ services }: Pick<Props, 'services'>) {
  const form = useForm({ name: '', serviceId: null as string | null });
  function submit(event: FormEvent) {
    event.preventDefault();
    form.post('/alerts/sources', {
      preserveScroll: true,
      onSuccess: () => form.reset(),
    });
  }
  return (
    <Card withBorder padding="lg">
      <Title order={5} mb="sm">
        New source
      </Title>
      <form onSubmit={submit}>
        <Stack gap="sm">
          <TextInput
            label="Name"
            placeholder="Grafana"
            value={form.data.name}
            onChange={(e) => form.setData('name', e.currentTarget.value)}
            error={form.errors.name}
          />
          <Select
            label="Service"
            description="Incidents declared from its alerts affect this service."
            placeholder="None"
            clearable
            data={services.map((s) => ({ value: String(s.id), label: s.name }))}
            value={form.data.serviceId}
            onChange={(value) => form.setData('serviceId', value)}
            error={form.errors.serviceId}
          />
          <Group justify="flex-end">
            <Button type="submit" loading={form.processing}>
              Create source
            </Button>
          </Group>
        </Stack>
      </form>
    </Card>
  );
}

export default function Sources({ ingestUrl, sources, services }: Props) {
  return (
    <>
      <Anchor component={Link} href="/alerts" size="sm" c="dimmed">
        ← Alerts
      </Anchor>
      <PageHeader
        title="Alert sources"
        description={
          <>
            Tools post alerts to <Code>{ingestUrl}</Code> with their token. The
            same <Code>dedupKey</Code> firing again counts as another
            occurrence; <Code>{'"status":"resolved"'}</Code> closes it.
          </>
        }
      />

      <SimpleGrid cols={{ base: 1, lg: 3 }} spacing="lg">
        <Stack style={{ gridColumn: 'span 2' }} data-xray="sources">
          {sources.map((source) => (
            <Card key={source.id} withBorder padding="lg">
              <Group justify="space-between" mb="xs">
                <Group gap="xs">
                  <Title order={4}>{source.name}</Title>
                  {source.service && (
                    <Badge variant="light" color="gray">
                      {source.service}
                    </Badge>
                  )}
                </Group>
                <Group gap={4}>
                  <Tooltip label="New token">
                    <ActionIcon
                      variant="subtle"
                      color="gray"
                      aria-label="New token"
                      onClick={() =>
                        router.post(
                          `/alerts/sources/${source.id}/rotate`,
                          {},
                          { preserveScroll: true },
                        )
                      }
                    >
                      <IconRefresh size={16} />
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip label="Delete source and its alerts">
                    <ActionIcon
                      variant="subtle"
                      color="gray"
                      aria-label="Delete source"
                      onClick={() =>
                        router.delete(`/alerts/sources/${source.id}`, {
                          preserveScroll: true,
                        })
                      }
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Tooltip>
                </Group>
              </Group>
              <Text size="sm" c="dimmed" mb="sm">
                {source.alerts} {source.alerts === 1 ? 'alert' : 'alerts'}
                {source.lastAlertAt &&
                  ` · last one ${relative(source.lastAlertAt)}`}
              </Text>
              <Group gap={4} mb="xs" wrap="nowrap">
                <Text size="xs" fw={600} w={48}>
                  Token
                </Text>
                <Code fz="xs">{source.token}</Code>
                <Copy value={source.token} label="Copy token" />
              </Group>
              <Group gap={4} align="flex-start" wrap="nowrap">
                <Code block fz="xs" style={{ flex: 1 }}>
                  {curl(ingestUrl, source.token)}
                </Code>
                <Copy value={curl(ingestUrl, source.token)} label="Copy curl" />
              </Group>
            </Card>
          ))}
          {sources.length === 0 && (
            <Text c="dimmed">No sources yet. Create one to get a token.</Text>
          )}
        </Stack>
        <NewSource services={services} />
      </SimpleGrid>
    </>
  );
}

Sources.layout = appLayout;
