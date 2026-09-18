import {
  Button,
  Paper,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { Head, useForm } from 'nestjs-mvc/react';
import type { FormEvent } from 'react';
import { guestLayout } from '../../layouts/GuestLayout';

interface Props {
  name: string;
  email: string;
  /** The signed URL to post the password to. */
  action: string;
}

/**
 * Where an invitation link lands: choose a password, and you're in. A link
 * that was changed, has expired or was used already never gets here: the
 * server answers it with the error page.
 */
export default function AcceptInvitation({ name, email, action }: Props) {
  const form = useForm({ password: '', confirmation: '' });

  function submit(event: FormEvent) {
    event.preventDefault();
    form.post(action);
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
