import {
  ActionIcon,
  Anchor,
  Button,
  Card,
  FileButton,
  Group,
  Progress,
  Stack,
  Text,
  Title,
  Tooltip,
} from '@mantine/core';
import {
  IconFile,
  IconPaperclip,
  IconPhoto,
  IconTrash,
} from '@tabler/icons-react';
import { router, useForm } from 'nestjs-mvc/react';
import { relative } from '../lib/format';
import type { Person } from '../types';

export interface AttachmentRow {
  id: number;
  filename: string;
  mimeType: string;
  size: number;
  uploadedBy: Person | null;
  createdAt: string;
}

const size = (bytes: number) =>
  bytes > 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} kB`;

/**
 * Files on an incident. Picking a file uploads it straight away: useForm
 * turns a File into a multipart request by itself, and reports progress.
 */
export function Attachments({
  incidentId,
  attachments,
  canRespond,
}: {
  incidentId: number;
  attachments: AttachmentRow[];
  canRespond: boolean;
}) {
  const base = `/incidents/${incidentId}/attachments`;
  const form = useForm({ file: null as File | null });

  function upload(file: File | null) {
    if (!file) return;
    form.setData('file', file);
    form.transform(() => ({ file }));
    form.post(base, {
      // Its own bag: the update and follow-up forms keep their errors.
      errorBag: 'attachment',
      preserveScroll: true,
      onSuccess: () => form.reset(),
    });
  }

  return (
    <Card withBorder padding="lg" data-xray="attachments">
      <Group justify="space-between" mb="sm">
        <Title order={5}>Attachments</Title>
        {canRespond && (
          <FileButton onChange={upload}>
            {(props) => (
              <Button
                {...props}
                size="compact-xs"
                variant="default"
                leftSection={<IconPaperclip size={12} />}
                loading={form.processing}
              >
                Attach
              </Button>
            )}
          </FileButton>
        )}
      </Group>
      {form.progress && (
        <Progress value={form.progress.percentage ?? 0} size="sm" mb="sm" />
      )}
      {form.errors.file && (
        <Text size="xs" c="red" mb="sm">
          {form.errors.file}
        </Text>
      )}
      <Stack gap={8}>
        {attachments.length === 0 && (
          <Text size="sm" c="dimmed">
            No files yet. Screenshots, logs and graphs help the next person.
          </Text>
        )}
        {attachments.map((file) => {
          const Icon = file.mimeType.startsWith('image/')
            ? IconPhoto
            : IconFile;
          return (
            <Group key={file.id} gap="xs" wrap="nowrap" align="flex-start">
              <Icon size={16} style={{ marginTop: 2, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                {/* A plain link: the browser downloads or shows the file. */}
                <Anchor
                  href={`${base}/${file.id}`}
                  target="_blank"
                  size="sm"
                  truncate
                  display="block"
                >
                  {file.filename}
                </Anchor>
                <Text size="xs" c="dimmed">
                  {size(file.size)} · {file.uploadedBy?.name ?? 'someone'} ·{' '}
                  {relative(file.createdAt)}
                </Text>
              </div>
              {canRespond && (
                <Tooltip label="Remove">
                  <ActionIcon
                    variant="subtle"
                    color="gray"
                    size="sm"
                    aria-label={`Remove ${file.filename}`}
                    onClick={() =>
                      router.delete(`${base}/${file.id}`, {
                        preserveScroll: true,
                      })
                    }
                  >
                    <IconTrash size={14} />
                  </ActionIcon>
                </Tooltip>
              )}
            </Group>
          );
        })}
      </Stack>
    </Card>
  );
}
