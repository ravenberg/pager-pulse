import {
  Alert,
  Button,
  Checkbox,
  Paper,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { IconInfoCircle } from '@tabler/icons-react';
import { Head, useForm } from 'nestjs-mvc/react';
import type { FormEvent } from 'react';
import { guestLayout } from '../../layouts/GuestLayout';

export default function Login() {
  const form = useForm({
    email: 'ada@pagerpulse.dev',
    password: '',
    remember: false,
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    form.post('/login', { onFinish: () => form.reset('password') });
  }

  return (
    <Paper withBorder shadow="sm" p="xl" radius="lg">
      <Head title="Log in · PagerPulse" />
      <Title order={3} mb={4}>
        Welcome back
      </Title>
      <Text c="dimmed" size="sm" mb="lg">
        Log in to respond to incidents.
      </Text>

      <form onSubmit={submit}>
        <Stack>
          <TextInput
            label="Email"
            type="email"
            autoComplete="username"
            value={form.data.email}
            onChange={(e) => form.setData('email', e.currentTarget.value)}
            error={form.errors.email}
          />
          <PasswordInput
            label="Password"
            autoComplete="current-password"
            autoFocus
            value={form.data.password}
            onChange={(e) => form.setData('password', e.currentTarget.value)}
            error={form.errors.password}
          />
          <Checkbox
            label="Keep me logged in"
            checked={form.data.remember}
            onChange={(e) => form.setData('remember', e.currentTarget.checked)}
          />
          <Button type="submit" loading={form.processing} fullWidth>
            Log in
          </Button>
        </Stack>
      </form>

      <Alert
        mt="lg"
        variant="light"
        color="gray"
        icon={<IconInfoCircle />}
        title="Demo accounts"
      >
        Everyone's password is <code>password</code>. Try <code>ada@</code>{' '}
        (admin), <code>grace@</code> (responder) or <code>barbara@</code>{' '}
        (viewer) at pagerpulse.dev.
      </Alert>
    </Paper>
  );
}

Login.layout = guestLayout;
