import {
  ActionIcon,
  Avatar,
  Badge,
  Button,
  Card,
  Group,
  MultiSelect,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Tabs,
  Text,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core';
import { IconTrash } from '@tabler/icons-react';
import { router, useForm } from 'nestjs-mvc/react';
import { type FormEvent, useState } from 'react';
import { PageHeader } from '../../components/PageHeader';
import { appLayout } from '../../layouts/AppLayout';
import type { Person } from '../../types';

interface ServiceRow {
  id: number;
  name: string;
  description: string;
  team: { id: number; name: string } | null;
}

interface TeamRow {
  id: number;
  name: string;
  members: Person[];
  services: string[];
}

interface Props {
  /** once(): may come from the browser's copy, refreshed after each change. */
  services: ServiceRow[];
  users: Person[];
  teams: TeamRow[];
  canManage: boolean;
}

const initials = (name: string) =>
  name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2);

function NewService({ teams }: { teams: TeamRow[] }) {
  const form = useForm({
    name: '',
    description: '',
    teamId: null as string | null,
  });
  function submit(event: FormEvent) {
    event.preventDefault();
    form.post('/catalog/services', {
      errorBag: 'service',
      preserveScroll: true,
      onSuccess: () => form.reset(),
    });
  }
  return (
    <form onSubmit={submit}>
      <Group align="flex-start" gap="xs">
        <TextInput
          placeholder="Service name"
          value={form.data.name}
          onChange={(e) => form.setData('name', e.currentTarget.value)}
          error={form.errors.name}
          w={180}
        />
        <TextInput
          placeholder="What it does"
          value={form.data.description}
          onChange={(e) => form.setData('description', e.currentTarget.value)}
          style={{ flex: 1 }}
        />
        <Select
          placeholder="Owning team"
          clearable
          data={teams.map((t) => ({ value: String(t.id), label: t.name }))}
          value={form.data.teamId}
          onChange={(value) => form.setData('teamId', value)}
          w={180}
        />
        <Button type="submit" loading={form.processing}>
          Add service
        </Button>
      </Group>
    </form>
  );
}

function NewTeam({ users }: { users: Person[] }) {
  const form = useForm({ name: '', memberIds: [] as string[] });
  function submit(event: FormEvent) {
    event.preventDefault();
    form.post('/catalog/teams', {
      errorBag: 'team',
      preserveScroll: true,
      onSuccess: () => form.reset(),
    });
  }
  return (
    <Card withBorder padding="lg">
      <Title order={5} mb="sm">
        New team
      </Title>
      <form onSubmit={submit}>
        <Stack gap="sm">
          <TextInput
            label="Name"
            placeholder="Payments"
            value={form.data.name}
            onChange={(e) => form.setData('name', e.currentTarget.value)}
            error={form.errors.name}
          />
          <MultiSelect
            label="Members"
            searchable
            data={users.map((u) => ({ value: String(u.id), label: u.name }))}
            value={form.data.memberIds}
            onChange={(value) => form.setData('memberIds', value)}
          />
          <Group justify="flex-end">
            <Button type="submit" loading={form.processing}>
              Create team
            </Button>
          </Group>
        </Stack>
      </form>
    </Card>
  );
}

export default function Index({ services, users, teams, canManage }: Props) {
  const [tab, setTab] = useState<string | null>('services');

  return (
    <>
      <PageHeader
        title="Catalog"
        description="The services PagerPulse knows about, and the teams that own them."
      />
      <Tabs value={tab} onChange={setTab}>
        <Tabs.List mb="lg">
          <Tabs.Tab value="services">Services ({services.length})</Tabs.Tab>
          <Tabs.Tab value="teams">Teams ({teams.length})</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="services">
          <Card withBorder padding={0} data-xray="services">
            <Table verticalSpacing="sm" horizontalSpacing="md">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Service</Table.Th>
                  <Table.Th w={220}>Owning team</Table.Th>
                  {canManage && <Table.Th w={50} />}
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {services.map((service) => (
                  <Table.Tr key={service.id}>
                    <Table.Td>
                      <Text fw={600} size="sm">
                        {service.name}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {service.description || '—'}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      {canManage ? (
                        <Select
                          size="xs"
                          placeholder="No owner"
                          clearable
                          data={teams.map((t) => ({
                            value: String(t.id),
                            label: t.name,
                          }))}
                          value={service.team ? String(service.team.id) : null}
                          onChange={(value) =>
                            router.patch(
                              `/catalog/services/${service.id}`,
                              { teamId: value },
                              { preserveScroll: true },
                            )
                          }
                        />
                      ) : (
                        <Text size="sm">{service.team?.name ?? '—'}</Text>
                      )}
                    </Table.Td>
                    {canManage && (
                      <Table.Td>
                        <Tooltip label="Remove service">
                          <ActionIcon
                            variant="subtle"
                            color="gray"
                            aria-label={`Remove ${service.name}`}
                            onClick={() =>
                              router.delete(`/catalog/services/${service.id}`, {
                                preserveScroll: true,
                              })
                            }
                          >
                            <IconTrash size={16} />
                          </ActionIcon>
                        </Tooltip>
                      </Table.Td>
                    )}
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Card>
          {canManage && (
            <Card withBorder padding="md" mt="md">
              <NewService teams={teams} />
            </Card>
          )}
        </Tabs.Panel>

        <Tabs.Panel value="teams">
          <SimpleGrid cols={{ base: 1, lg: 3 }} spacing="lg" data-xray="teams">
            {teams.map((team) => (
              <Card key={team.id} withBorder padding="lg">
                <Group justify="space-between" mb="sm">
                  <Title order={5}>{team.name}</Title>
                  {canManage && (
                    <Tooltip label="Remove team">
                      <ActionIcon
                        variant="subtle"
                        color="gray"
                        aria-label={`Remove ${team.name}`}
                        onClick={() =>
                          router.delete(`/catalog/teams/${team.id}`, {
                            preserveScroll: true,
                          })
                        }
                      >
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Tooltip>
                  )}
                </Group>
                <Avatar.Group mb="sm">
                  {team.members.map((member) => (
                    <Tooltip key={member.id} label={member.name}>
                      <Avatar radius="xl" color="gray">
                        {initials(member.name)}
                      </Avatar>
                    </Tooltip>
                  ))}
                  {team.members.length === 0 && (
                    <Text size="sm" c="dimmed">
                      No members yet
                    </Text>
                  )}
                </Avatar.Group>
                <Group gap={4}>
                  {team.services.map((name) => (
                    <Badge key={name} variant="outline" color="gray" size="sm">
                      {name}
                    </Badge>
                  ))}
                  {team.services.length === 0 && (
                    <Text size="xs" c="dimmed">
                      Owns no services
                    </Text>
                  )}
                </Group>
              </Card>
            ))}
            {canManage && <NewTeam users={users} />}
          </SimpleGrid>
        </Tabs.Panel>
      </Tabs>
    </>
  );
}

Index.layout = appLayout;
