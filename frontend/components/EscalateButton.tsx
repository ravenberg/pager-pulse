import { Button, Modal, Select, Stack, TextInput } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconSpeakerphone } from '@tabler/icons-react';
import { router, useForm } from 'nestjs-mvc/react';
import type { FormEvent } from 'react';

interface Path {
  id: number;
  name: string;
}

/**
 * incident.io's "Escalate to someone": page the first level of a path. The
 * paths come from the page's optional `escalationPaths` prop, loaded when the
 * dialog opens, unless the page already has them.
 */
export function EscalateButton({
  paths,
  incidentId = null,
  alertId = null,
  reason = '',
  size = 'sm',
  variant = 'default',
}: {
  paths: Path[] | undefined;
  incidentId?: number | null;
  alertId?: number | null;
  reason?: string;
  size?: 'xs' | 'sm' | 'compact-xs';
  variant?: 'default' | 'light' | 'filled';
}) {
  const [opened, { open, close }] = useDisclosure(false);
  const form = useForm({
    pathId: null as string | null,
    reason,
    incidentId,
    alertId,
  });

  function show() {
    if (!paths) router.reload({ only: ['escalationPaths'] });
    open();
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    form.post('/escalations', {
      preserveScroll: true,
      onSuccess: () => {
        form.reset();
        close();
      },
    });
  }

  return (
    <>
      <Button
        size={size}
        variant={variant}
        leftSection={<IconSpeakerphone size={14} />}
        onClick={show}
      >
        Escalate
      </Button>
      <Modal opened={opened} onClose={close} title="Escalate to someone">
        <form onSubmit={submit}>
          <Stack>
            <Select
              label="Escalation path"
              placeholder={paths ? 'Pick a path' : 'Loading…'}
              data={(paths ?? []).map((p) => ({
                value: String(p.id),
                label: p.name,
              }))}
              value={form.data.pathId}
              onChange={(value) => form.setData('pathId', value)}
              error={form.errors.pathId}
            />
            <TextInput
              label="Why"
              placeholder="What do they need to know?"
              value={form.data.reason}
              onChange={(e) => form.setData('reason', e.currentTarget.value)}
              error={form.errors.reason}
            />
            <Button type="submit" loading={form.processing}>
              Page them
            </Button>
          </Stack>
        </form>
      </Modal>
    </>
  );
}
