import {
  Button,
  Card,
  Group,
  MultiSelect,
  Radio,
  Select,
  Stack,
  Switch,
  Text,
  TextInput,
  Textarea,
} from '@mantine/core';
import { Link, useForm } from 'nestjs-mvc/react';
import type { FormEvent } from 'react';
import { PageHeader } from '../../components/PageHeader';
import { appLayout } from '../../layouts/AppLayout';
import type { Person, Severity } from '../../types';

interface Props {
  services: { id: number; name: string }[];
  users: Person[];
}

const SEVERITIES: { value: Severity; label: string; description: string }[] = [
  {
    value: 'critical',
    label: 'Critical',
    description: 'Full outage or data loss. All hands.',
  },
  {
    value: 'major',
    label: 'Major',
    description: 'A core feature is broken for many customers.',
  },
  {
    value: 'minor',
    label: 'Minor',
    description: 'Degraded or broken for a few customers.',
  },
];

export default function Create({ services, users }: Props) {
  const form = useForm({
    title: '',
    summary: '',
    severity: '' as Severity | '',
    serviceIds: [] as string[],
    leadId: null as string | null,
    isPublic: true,
    isPrivate: false,
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    form.post('/incidents');
  }

  return (
    <>
      <PageHeader
        title="Declare an incident"
        description="Get the right people in the room. You can change everything later."
      />
      <Card withBorder padding="xl" maw={720}>
        <form onSubmit={submit}>
          <Stack>
            <TextInput
              label="What's happening?"
              placeholder="Checkout failing for EU customers"
              data-autofocus
              autoFocus
              value={form.data.title}
              onChange={(e) => form.setData('title', e.currentTarget.value)}
              error={form.errors.title}
            />
            <Textarea
              label="Summary"
              description="The first update on the timeline. Keep it short: impact first."
              autosize
              minRows={3}
              value={form.data.summary}
              onChange={(e) => form.setData('summary', e.currentTarget.value)}
              error={form.errors.summary}
            />
            <Radio.Group
              label="Severity"
              value={form.data.severity}
              onChange={(value) => form.setData('severity', value as Severity)}
              error={form.errors.severity}
            >
              <Stack gap="xs" mt="xs">
                {SEVERITIES.map((severity) => (
                  <Radio.Card
                    key={severity.value}
                    value={severity.value}
                    p="sm"
                    radius="md"
                  >
                    <Group wrap="nowrap" align="flex-start">
                      <Radio.Indicator />
                      <div>
                        <Text fw={600} size="sm">
                          {severity.label}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {severity.description}
                        </Text>
                      </div>
                    </Group>
                  </Radio.Card>
                ))}
              </Stack>
            </Radio.Group>
            <MultiSelect
              label="Affected services"
              placeholder="Pick services"
              data={services.map((service) => ({
                value: String(service.id),
                label: service.name,
              }))}
              value={form.data.serviceIds}
              onChange={(value) => form.setData('serviceIds', value)}
              error={form.errors.serviceIds}
            />
            <Select
              label="Incident lead"
              description="Leave empty to lead it yourself."
              clearable
              searchable
              data={users.map((user) => ({
                value: String(user.id),
                label: user.name,
              }))}
              value={form.data.leadId}
              onChange={(value) => form.setData('leadId', value)}
              error={form.errors.leadId}
            />
            <Switch
              label="Show on the public status page"
              checked={form.data.isPublic && !form.data.isPrivate}
              disabled={form.data.isPrivate}
              onChange={(e) =>
                form.setData('isPublic', e.currentTarget.checked)
              }
            />
            <Switch
              label="Private"
              description="Only admins, you and the lead can see it. For security or HR matters."
              checked={form.data.isPrivate}
              onChange={(e) =>
                form.setData('isPrivate', e.currentTarget.checked)
              }
            />
            <Group justify="flex-end" mt="md">
              <Button variant="default" component={Link} href="/incidents">
                Cancel
              </Button>
              <Button type="submit" loading={form.processing}>
                Declare incident
              </Button>
            </Group>
          </Stack>
        </form>
      </Card>
    </>
  );
}

Create.layout = appLayout;
