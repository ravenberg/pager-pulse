import {
  Badge,
  Button,
  Card,
  Group,
  PasswordInput,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useForm, usePage } from 'nestjs-mvc/react';
import type { FormEvent, ReactNode } from 'react';
import { PageHeader } from '../../components/PageHeader';
import { capitalize, day } from '../../lib/format';
import { appLayout } from '../../layouts/AppLayout';
import type { SharedProps } from '../../types';

interface Props {
  role: string;
  memberSince: string;
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <SimpleGrid cols={{ base: 1, md: 3 }} spacing="lg">
      <div>
        <Title order={4}>{title}</Title>
        <Text size="sm" c="dimmed">
          {description}
        </Text>
      </div>
      <Card withBorder padding="lg" style={{ gridColumn: 'span 2' }}>
        {children}
      </Card>
    </SimpleGrid>
  );
}

function ProfileForm() {
  const { props } = usePage<SharedProps>();
  const user = props.auth.user!;
  const form = useForm({ name: user.name, email: user.email });

  function submit(event: FormEvent) {
    event.preventDefault();
    // Its own error bag: errors land here, not on the password form.
    form.put('/account', {
      errorBag: 'profile',
      preserveScroll: true,
      onSuccess: () => form.setDefaults(),
    });
  }

  return (
    <form onSubmit={submit}>
      <Stack>
        <TextInput
          label="Name"
          autoComplete="name"
          value={form.data.name}
          onChange={(e) => form.setData('name', e.currentTarget.value)}
          error={form.errors.name}
        />
        <TextInput
          label="Email"
          type="email"
          autoComplete="email"
          value={form.data.email}
          onChange={(e) => form.setData('email', e.currentTarget.value)}
          error={form.errors.email}
        />
        <Group justify="flex-end">
          <Button
            type="submit"
            loading={form.processing}
            disabled={!form.isDirty}
          >
            Save profile
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

function PasswordForm() {
  // Precognitive: the new password is checked against the server's rules as
  // you type, by the same schema the real submit runs through.
  const form = useForm('put', '/account/password', {
    current: '',
    password: '',
    confirmation: '',
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    form.submit({
      errorBag: 'password',
      preserveScroll: true,
      onSuccess: () => form.reset(),
    });
  }

  return (
    <form onSubmit={submit}>
      <Stack>
        <PasswordInput
          label="Current password"
          autoComplete="current-password"
          value={form.data.current}
          onChange={(e) => form.setData('current', e.currentTarget.value)}
          error={form.errors.current}
        />
        <PasswordInput
          label="New password"
          description="At least 10 characters."
          autoComplete="new-password"
          value={form.data.password}
          onChange={(e) => form.setData('password', e.currentTarget.value)}
          onBlur={() => form.validate('password')}
          error={form.errors.password}
        />
        <PasswordInput
          label="New password, again"
          autoComplete="new-password"
          value={form.data.confirmation}
          onChange={(e) => form.setData('confirmation', e.currentTarget.value)}
          onBlur={() => form.validate('confirmation')}
          error={form.errors.confirmation}
        />
        <Group justify="flex-end">
          <Button type="submit" loading={form.processing}>
            Change password
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

export default function Edit({ role, memberSince }: Props) {
  return (
    <>
      <PageHeader
        title="Your account"
        description={
          <Group gap="xs" component="span">
            <Badge variant="default" component="span">
              {capitalize(role)}
            </Badge>
            <span>Here since {day(memberSince)}</span>
          </Group>
        }
      />
      <Stack gap="xl" maw={960}>
        <Section
          title="Profile"
          description="How you appear on incidents, schedules and follow-ups."
        >
          <ProfileForm />
        </Section>
        <Section
          title="Password"
          description="You stay logged in on this device after changing it."
        >
          <PasswordForm />
        </Section>
      </Stack>
    </>
  );
}

Edit.layout = appLayout;
