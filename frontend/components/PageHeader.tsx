import { Group, Stack, Text, Title } from '@mantine/core';
import { Head } from 'nestjs-mvc/react';
import type { ReactNode } from 'react';

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <Group justify="space-between" align="flex-start" mb="lg" wrap="nowrap">
      <Head title={`${title} · PagerPulse`} />
      <Stack gap={4}>
        <Title order={2}>{title}</Title>
        {description && (
          <Text c="dimmed" size="sm">
            {description}
          </Text>
        )}
      </Stack>
      {actions}
    </Group>
  );
}
