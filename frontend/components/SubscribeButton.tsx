import { Button, Popover, Stack, Text, TextInput } from '@mantine/core';
import { IconMail } from '@tabler/icons-react';
import { useForm } from 'nestjs-mvc/react';
import { type FormEvent, useState } from 'react';

/** "Subscribe to updates": an email for every public status update. */
export function SubscribeButton() {
  const [opened, setOpened] = useState(false);
  const form = useForm({ email: '' });

  function submit(event: FormEvent) {
    event.preventDefault();
    form.post('/status/subscribe', {
      preserveScroll: true,
      onSuccess: () => {
        form.reset();
        setOpened(false);
      },
    });
  }

  return (
    <Popover
      opened={opened}
      onChange={setOpened}
      position="bottom-end"
      width={300}
      shadow="md"
    >
      <Popover.Target>
        <Button
          variant="default"
          size="sm"
          leftSection={<IconMail size={16} />}
          onClick={() => setOpened((o) => !o)}
        >
          Subscribe to updates
        </Button>
      </Popover.Target>
      <Popover.Dropdown>
        <form onSubmit={submit}>
          <Stack gap="sm">
            <Text size="sm">Get an email whenever we post an update.</Text>
            <TextInput
              type="email"
              placeholder="you@example.com"
              value={form.data.email}
              onChange={(e) => form.setData('email', e.currentTarget.value)}
              error={form.errors.email}
            />
            <Button type="submit" loading={form.processing}>
              Subscribe
            </Button>
          </Stack>
        </form>
      </Popover.Dropdown>
    </Popover>
  );
}
