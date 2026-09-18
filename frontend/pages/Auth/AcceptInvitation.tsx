import {
  Anchor,
  Button,
  Paper,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { Head, Link, useForm } from 'nestjs-mvc/react';
import type { FormEvent } from 'react';
import { Illustration } from '../../components/Illustration';
import { guestLayout } from '../../layouts/GuestLayout';

interface Props {
  state: 'valid' | 'expired' | 'invalid';
  name: string;
  email: string;
  /** The signed URL to post the password to, while the link is valid. */
  action: string | null;
}

const PROBLEM = {
  expired: {
    title: 'This invitation has expired',
    body: 'Invitations work for a week. Ask whoever invited you to send it again.',
  },
  invalid: {
    title: 'This invitation no longer works',
    body: 'It was used already, or a newer one was sent. Log in, or ask for a new invitation.',
  },
};

/** Where the link in an invitation email lands: choose a password, and you're in. */
export default function AcceptInvitation({
  state,
  name,
  email,
  action,
}: Props) {
  const form = useForm({ password: '', confirmation: '' });

  function submit(event: FormEvent) {
    event.preventDefault();
    if (action) form.post(action);
  }

  if (state !== 'valid' || !action) {
    const problem = PROBLEM[state === 'valid' ? 'invalid' : state];
    return (
      <Paper withBorder shadow="sm" p="xl" radius="lg">
        <Head title={`${problem.title} · PagerPulse`} />
        <Stack gap="sm">
          <Illustration name="access-denied" width={160} />
          <Title order={3}>{problem.title}</Title>
          <Text size="sm" c="dimmed">
            {problem.body}
          </Text>
          <Anchor component={Link} href="/login" size="sm">
            To the login page
          </Anchor>
        </Stack>
      </Paper>
    );
  }

  return (
    <Paper withBorder shadow="sm" p="xl" radius="lg">
      <Head title="Join PagerPulse" />
      <Title order={3} mb={4}>
        Welcome, {name.split(' ')[0]}
      </Title>
      <Text c="dimmed" size="sm" mb="lg">
        Choose a password and you're in.
      </Text>
      <form onSubmit={submit}>
        <Stack>
          <TextInput
            label="Email"
            value={email}
            readOnly
            autoComplete="username"
          />
          <PasswordInput
            label="Password"
            description="At least 10 characters."
            autoComplete="new-password"
            autoFocus
            value={form.data.password}
            onChange={(e) => form.setData('password', e.currentTarget.value)}
            error={form.errors.password}
          />
          <PasswordInput
            label="Password, again"
            autoComplete="new-password"
            value={form.data.confirmation}
            onChange={(e) =>
              form.setData('confirmation', e.currentTarget.value)
            }
            error={form.errors.confirmation}
          />
          <Button type="submit" loading={form.processing} fullWidth>
            Join PagerPulse
          </Button>
        </Stack>
      </form>
    </Paper>
  );
}

AcceptInvitation.layout = guestLayout;
