import {
  ActionIcon,
  Avatar,
  Badge,
  Button,
  Card,
  CopyButton,
  Group,
  Menu,
  Modal,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  IconCheck,
  IconCopy,
  IconDots,
  IconLink,
  IconPlus,
  IconUserCheck,
  IconUserOff,
} from '@tabler/icons-react';
import { router, useForm, usePage } from 'nestjs-mvc/react';
import { type FormEvent, useEffect, useState } from 'react';
import { PageHeader } from '../../components/PageHeader';
import { capitalize, day } from '../../lib/format';
import { appLayout } from '../../layouts/AppLayout';
import type { Role } from '../../types';

interface PersonRow {
  id: number;
  name: string;
  email: string;
  role: Role;
  state: 'active' | 'invited' | 'deactivated';
  since: string;
  isYou: boolean;
}

const ROLES: { value: Role; label: string; description: string }[] = [
  {
    value: 'admin',
    label: 'Admin',
    description: 'Everything, including people and the catalog.',
  },
  {
    value: 'responder',
    label: 'Responder',
    description: 'Declares and works on incidents.',
  },
  {
    value: 'viewer',
    label: 'Viewer',
    description: 'Reads along; changes nothing.',
  },
];

const initials = (name: string) =>
  name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2);

const keep = { preserveScroll: true, preserveState: true };

function InviteButton() {
  const [opened, { open, close }] = useDisclosure(false);
  const form = useForm({ name: '', email: '', role: 'responder' as Role });

  function submit(event: FormEvent) {
    event.preventDefault();
    form.post('/people', {
      errorBag: 'invite',
      ...keep,
      onSuccess: () => {
        form.reset();
        close();
      },
    });
  }

  return (
    <>
      <Button leftSection={<IconPlus size={16} />} onClick={open}>
        Add someone
      </Button>
      <Modal opened={opened} onClose={close} title="Add someone">
        <form onSubmit={submit}>
          <Stack>
            <TextInput
              label="Name"
              data-autofocus
              value={form.data.name}
              onChange={(e) => form.setData('name', e.currentTarget.value)}
              error={form.errors.name}
            />
            <TextInput
              label="Email"
              type="email"
              description="What they log in with. You get a link to share with them."
              value={form.data.email}
              onChange={(e) => form.setData('email', e.currentTarget.value)}
              error={form.errors.email}
            />
            <Select
              label="Role"
              allowDeselect={false}
              data={ROLES}
              value={form.data.role}
              onChange={(role) => role && form.setData('role', role as Role)}
              description={
                ROLES.find((r) => r.value === form.data.role)?.description
              }
              error={form.errors.role}
            />
            <Group justify="flex-end">
              <Button variant="default" onClick={close}>
                Cancel
              </Button>
              <Button type="submit" loading={form.processing}>
                Add and get link
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </>
  );
}

interface Invitation {
  name: string;
  url: string;
}

/**
 * The link arrives as flash data, on the one page after it was made. It is
 * shown here once; nobody can look it up again, so a lost link means a new
 * one.
 */
function ShareInvitation() {
  const { flash } = usePage();
  const [shown, setShown] = useState<Invitation | null>(null);
  const invitation = flash?.invitation as Invitation | undefined;
  useEffect(() => {
    if (invitation) setShown(invitation);
  }, [invitation]);

  return (
    <Modal
      opened={!!shown}
      onClose={() => setShown(null)}
      title={`Share this link with ${shown?.name.split(' ')[0]}`}
    >
      <Stack>
        <Text size="sm">
          Send it in a direct message: whoever opens it chooses the password for{' '}
          {shown?.name}. It works once, for a week.
        </Text>
        <TextInput
          readOnly
          value={shown?.url ?? ''}
          onFocus={(e) => e.currentTarget.select()}
          rightSection={
            <CopyButton value={shown?.url ?? ''}>
              {({ copied, copy }) => (
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  onClick={copy}
                  aria-label={copied ? 'Copied' : 'Copy link'}
                >
                  {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
                </ActionIcon>
              )}
            </CopyButton>
          }
        />
        <Text size="xs" c="dimmed">
          We don't keep it. Lost it? Choose “New invitation link” from their
          row; this one then stops working.
        </Text>
        <Group justify="flex-end">
          <Button onClick={() => setShown(null)}>Done</Button>
        </Group>
      </Stack>
    </Modal>
  );
}

function StateBadge({ person }: { person: PersonRow }) {
  if (person.state === 'invited')
    return (
      <Badge variant="default" tt="none" fw={500}>
        Invited {day(person.since)}
      </Badge>
    );
  if (person.state === 'deactivated')
    return (
      <Badge variant="outline" color="gray" tt="none" fw={500}>
        Deactivated
      </Badge>
    );
  return null;
}

function Actions({
  person,
  onDeactivate,
}: {
  person: PersonRow;
  onDeactivate: () => void;
}) {
  if (person.isYou) return null;
  return (
    <Menu position="bottom-end" withinPortal>
      <Menu.Target>
        <ActionIcon
          variant="subtle"
          color="gray"
          aria-label={`Manage ${person.name}`}
        >
          <IconDots size={16} />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        {person.state === 'invited' && (
          <Menu.Item
            leftSection={<IconLink size={16} />}
            onClick={() => router.post(`/people/${person.id}/link`, {}, keep)}
          >
            New invitation link
          </Menu.Item>
        )}
        {person.state === 'deactivated' ? (
          <Menu.Item
            leftSection={<IconUserCheck size={16} />}
            onClick={() =>
              router.post(`/people/${person.id}/reactivate`, {}, keep)
            }
          >
            Reactivate
          </Menu.Item>
        ) : (
          <Menu.Item
            color="red"
            leftSection={<IconUserOff size={16} />}
            onClick={onDeactivate}
          >
            Deactivate
          </Menu.Item>
        )}
      </Menu.Dropdown>
    </Menu>
  );
}

/** Who can use PagerPulse, for admins. */
export default function Index({ people }: { people: PersonRow[] }) {
  const [leaving, setLeaving] = useState<PersonRow | null>(null);
  const count = (state: PersonRow['state']) =>
    people.filter((p) => p.state === state).length;

  return (
    <>
      <PageHeader
        title="People"
        description={`${count('active')} active${
          count('invited') ? ` · ${count('invited')} invited` : ''
        }${count('deactivated') ? ` · ${count('deactivated')} deactivated` : ''}`}
        actions={<InviteButton />}
      />
      <ShareInvitation />

      <Card withBorder padding={0} data-xray="people">
        <Table verticalSpacing="sm" horizontalSpacing="md">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Person</Table.Th>
              <Table.Th w={180}>Role</Table.Th>
              <Table.Th visibleFrom="sm" />
              <Table.Th w={48} />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {people.map((person) => (
              <Table.Tr
                key={person.id}
                style={{
                  opacity: person.state === 'deactivated' ? 0.55 : undefined,
                }}
              >
                <Table.Td>
                  <Group gap="sm" wrap="nowrap">
                    <Avatar color="gray" radius="xl" size="md">
                      {initials(person.name)}
                    </Avatar>
                    <div style={{ minWidth: 0 }}>
                      <Text size="sm" fw={600}>
                        {person.name}
                        {person.isYou && (
                          <Text span c="dimmed" fw={400}>
                            {' '}
                            (you)
                          </Text>
                        )}
                      </Text>
                      <Text size="xs" c="dimmed" truncate>
                        {person.email}
                      </Text>
                    </div>
                  </Group>
                </Table.Td>
                <Table.Td>
                  {person.isYou || person.state === 'deactivated' ? (
                    <Text size="sm">{capitalize(person.role)}</Text>
                  ) : (
                    <Select
                      size="xs"
                      allowDeselect={false}
                      aria-label={`Role of ${person.name}`}
                      data={ROLES}
                      value={person.role}
                      onChange={(role) =>
                        role &&
                        router.patch(`/people/${person.id}`, { role }, keep)
                      }
                    />
                  )}
                </Table.Td>
                <Table.Td visibleFrom="sm">
                  <StateBadge person={person} />
                </Table.Td>
                <Table.Td>
                  <Actions
                    person={person}
                    onDeactivate={() => setLeaving(person)}
                  />
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Card>

      <Modal
        opened={!!leaving}
        onClose={() => setLeaving(null)}
        title={`Deactivate ${leaving?.name}?`}
      >
        <Stack>
          <Text size="sm">
            They are logged out at once and can't log in again. Their incidents,
            updates and follow-ups stay as they are. You can reactivate them
            later.
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setLeaving(null)}>
              Cancel
            </Button>
            <Button
              color="red"
              onClick={() =>
                leaving &&
                router.post(
                  `/people/${leaving.id}/deactivate`,
                  {},
                  {
                    ...keep,
                    onFinish: () => setLeaving(null),
                  },
                )
              }
            >
              Deactivate
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}

Index.layout = appLayout;
