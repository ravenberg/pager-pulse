import { Anchor, Checkbox, Group, Text } from '@mantine/core';
import { Link, router } from 'nestjs-mvc/react';
import type { FollowUpRow } from '../types';

export function FollowUpItem({
  item,
  canRespond,
  showIncident = false,
}: {
  item: FollowUpRow;
  canRespond: boolean;
  showIncident?: boolean;
}) {
  const done = item.completedAt !== null;
  return (
    <Group wrap="nowrap" align="flex-start" gap="sm">
      <Checkbox
        mt={2}
        checked={done}
        disabled={!canRespond}
        aria-label={done ? 'Reopen' : 'Mark as done'}
        onChange={() =>
          router.patch(
            `/follow-ups/${item.id}/toggle`,
            {},
            { preserveScroll: true },
          )
        }
      />
      <div>
        <Text
          size="sm"
          td={done ? 'line-through' : undefined}
          c={done ? 'dimmed' : undefined}
        >
          {item.title}
        </Text>
        <Text size="xs" c="dimmed">
          {item.assignee?.name ?? 'Unassigned'}
          {showIncident && item.incident && (
            <>
              {' · '}
              <Anchor
                component={Link}
                href={`/incidents/${item.incident.id}`}
                size="xs"
              >
                {item.incident.reference} {item.incident.title}
              </Anchor>
            </>
          )}
        </Text>
      </div>
    </Group>
  );
}
