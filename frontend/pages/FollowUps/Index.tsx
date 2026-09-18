import { Card, Group, SegmentedControl, Stack, Text } from '@mantine/core';
import { router } from 'nestjs-mvc/react';
import { FollowUpItem } from '../../components/FollowUpItem';
import { PageHeader } from '../../components/PageHeader';
import { appLayout } from '../../layouts/AppLayout';
import type { FollowUpRow } from '../../types';

interface Props {
  filters: { scope: string; state: string };
  followUps: FollowUpRow[];
  canRespond: boolean;
}

export default function Index({ filters, followUps, canRespond }: Props) {
  const apply = (next: Partial<Props['filters']>) =>
    router.get(
      '/follow-ups',
      { ...filters, ...next },
      { preserveState: true, replace: true },
    );

  return (
    <>
      <PageHeader
        title="Follow-ups"
        description="The work that makes sure it does not happen again."
      />
      <Group mb="md">
        <SegmentedControl
          value={filters.scope}
          onChange={(scope) => apply({ scope })}
          data={[
            { value: 'mine', label: 'Assigned to me' },
            { value: 'all', label: 'Everyone' },
          ]}
        />
        <SegmentedControl
          value={filters.state}
          onChange={(state) => apply({ state })}
          data={[
            { value: 'open', label: 'Open' },
            { value: 'done', label: 'Done' },
          ]}
        />
      </Group>
      <Card withBorder padding="lg">
        <Stack gap="md">
          {followUps.length === 0 && (
            <Text c="dimmed">Nothing here. Enjoy the quiet.</Text>
          )}
          {followUps.map((item) => (
            <FollowUpItem
              key={item.id}
              item={item}
              canRespond={canRespond}
              showIncident
            />
          ))}
        </Stack>
      </Card>
    </>
  );
}

Index.layout = appLayout;
