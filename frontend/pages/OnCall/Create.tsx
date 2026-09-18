import {
  Button,
  Card,
  Group,
  MultiSelect,
  NumberInput,
  Stack,
  TextInput,
} from '@mantine/core';
import { DateTimePicker } from '@mantine/dates';
import { Link, useForm } from 'nestjs-mvc/react';
import type { FormEvent } from 'react';
import { PageHeader } from '../../components/PageHeader';
import { appLayout } from '../../layouts/AppLayout';
import type { Person } from '../../types';

export default function Create({ users }: { users: Person[] }) {
  const form = useForm({
    name: '',
    startsAt: null as string | null,
    shiftHours: 168 as number | string,
    memberIds: [] as string[],
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    // Mantine gives local "YYYY-MM-DD HH:mm:ss"; the server wants an instant.
    form.transform((data) => ({
      ...data,
      startsAt: data.startsAt
        ? new Date(data.startsAt.replace(' ', 'T')).toISOString()
        : '',
    }));
    form.post('/on-call');
  }

  return (
    <>
      <PageHeader
        title="New schedule"
        description="People take turns in the order you add them."
      />
      <Card withBorder padding="xl" maw={640}>
        <form onSubmit={submit}>
          <Stack>
            <TextInput
              label="Name"
              placeholder="Primary"
              value={form.data.name}
              onChange={(e) => form.setData('name', e.currentTarget.value)}
              error={form.errors.name}
            />
            <DateTimePicker
              label="First shift starts"
              placeholder="Pick a date and time"
              value={form.data.startsAt}
              onChange={(value) => form.setData('startsAt', value)}
              error={form.errors.startsAt}
            />
            <NumberInput
              label="Shift length (hours)"
              description="168 is a week, 24 a day."
              min={1}
              value={form.data.shiftHours}
              onChange={(value) => form.setData('shiftHours', value)}
              error={form.errors.shiftHours}
            />
            <MultiSelect
              label="Rotation"
              description="In order: the first person takes the first shift."
              searchable
              data={users.map((user) => ({
                value: String(user.id),
                label: user.name,
              }))}
              value={form.data.memberIds}
              onChange={(value) => form.setData('memberIds', value)}
              error={form.errors.memberIds}
            />
            <Group justify="flex-end" mt="md">
              <Button variant="default" component={Link} href="/on-call">
                Cancel
              </Button>
              <Button type="submit" loading={form.processing}>
                Create schedule
              </Button>
            </Group>
          </Stack>
        </form>
      </Card>
    </>
  );
}

Create.layout = appLayout;
