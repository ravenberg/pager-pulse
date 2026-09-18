import {
  ActionIcon,
  Avatar,
  Button,
  Card,
  Group,
  NumberInput,
  Select,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import { Link, useForm } from 'nestjs-mvc/react';
import type { FormEvent } from 'react';
import { PageHeader } from '../../components/PageHeader';
import { appLayout } from '../../layouts/AppLayout';
import type { Person } from '../../types';

interface Props {
  schedules: { id: number; name: string }[];
  users: Person[];
}

type Level = { target: string | null; delayMinutes: number | string };

export default function PathCreate({ schedules, users }: Props) {
  const form = useForm({
    name: '',
    levels: [{ target: null, delayMinutes: 5 }] as Level[],
  });

  const targets = [
    {
      group: 'Whoever is on call',
      items: schedules.map((s) => ({
        value: `schedule:${s.id}`,
        label: s.name,
      })),
    },
    {
      group: 'A person',
      items: users.map((u) => ({ value: `user:${u.id}`, label: u.name })),
    },
  ];

  const setLevel = (index: number, patch: Partial<Level>) =>
    form.setData(
      'levels',
      form.data.levels.map((level, i) =>
        i === index ? { ...level, ...patch } : level,
      ),
    );

  function submit(event: FormEvent) {
    event.preventDefault();
    form.post('/on-call/paths');
  }

  // Errors for nested fields arrive under dot paths: `levels.1.target`.
  const errorFor = (index: number, field: keyof Level) =>
    (form.errors as Record<string, string | undefined>)[
      `levels.${index}.${field}`
    ];

  return (
    <>
      <PageHeader
        title="New escalation path"
        description="Who gets paged first, and who next when nobody answers."
      />
      <Card withBorder padding="xl" maw={720}>
        <form onSubmit={submit}>
          <Stack>
            <TextInput
              label="Name"
              placeholder="Payments"
              value={form.data.name}
              onChange={(e) => form.setData('name', e.currentTarget.value)}
              error={form.errors.name}
            />
            <Text size="sm" fw={500}>
              Levels
            </Text>
            {form.data.levels.map((level, index) => (
              <Group key={index} align="flex-start" wrap="nowrap">
                <Avatar size="md" radius="xl" color="gray" mt={4}>
                  {index + 1}
                </Avatar>
                <Select
                  placeholder="Page…"
                  searchable
                  style={{ flex: 2 }}
                  data={targets}
                  value={level.target}
                  onChange={(target) => setLevel(index, { target })}
                  error={errorFor(index, 'target')}
                />
                <NumberInput
                  style={{ flex: 1 }}
                  min={1}
                  suffix=" min"
                  description={
                    index < form.data.levels.length - 1
                      ? 'before the next level'
                      : 'to answer'
                  }
                  value={level.delayMinutes}
                  onChange={(delayMinutes) => setLevel(index, { delayMinutes })}
                  error={errorFor(index, 'delayMinutes')}
                />
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  mt={6}
                  aria-label="Remove level"
                  disabled={form.data.levels.length === 1}
                  onClick={() =>
                    form.setData(
                      'levels',
                      form.data.levels.filter((_, i) => i !== index),
                    )
                  }
                >
                  <IconTrash size={16} />
                </ActionIcon>
              </Group>
            ))}
            {form.errors.levels && (
              <Text size="sm" c="red">
                {form.errors.levels}
              </Text>
            )}
            <Group>
              <Button
                variant="subtle"
                leftSection={<IconPlus size={16} />}
                onClick={() =>
                  form.setData('levels', [
                    ...form.data.levels,
                    { target: null, delayMinutes: 10 },
                  ])
                }
              >
                Add a level
              </Button>
            </Group>
            <Group justify="flex-end" mt="md">
              <Button
                variant="default"
                component={Link}
                href="/on-call?tab=paths"
              >
                Cancel
              </Button>
              <Button type="submit" loading={form.processing}>
                Create path
              </Button>
            </Group>
          </Stack>
        </form>
      </Card>
    </>
  );
}

PathCreate.layout = appLayout;
