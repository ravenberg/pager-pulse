import {
  ActionIcon,
  Card,
  Group,
  Menu,
  SimpleGrid,
  Stack,
  Text,
} from '@mantine/core';
import { IconCircleCheck, IconDots } from '@tabler/icons-react';
import { Link, router } from 'nestjs-mvc/react';
import { type DragEvent, useState } from 'react';
import { capitalize, relative } from '../lib/format';
import { STATUS_COLOR } from '../lib/theme';
import type { IncidentRow, IncidentStatus } from '../types';
import { SeverityBadge } from './Badges';

const COLUMNS: IncidentStatus[] = ['investigating', 'identified', 'monitoring'];
const MIME = 'application/x-pager-pulse-incident';

/**
 * Moves an incident to another status. The board changes at once
 * (`optimistic`); the PATCH redirects back here, and `only` keeps that
 * response to the list and the counter, so the insights below are not sent
 * again. When the server refuses, Inertia puts the card back.
 */
export function moveIncident(incident: IncidentRow, status: IncidentStatus) {
  if (incident.status === status) return;
  router
    .optimistic<{ active: IncidentRow[] }>((props) => ({
      active:
        status === 'resolved'
          ? props.active.filter((i) => i.id !== incident.id)
          : props.active.map((i) =>
              i.id === incident.id ? { ...i, status } : i,
            ),
    }))
    .patch(
      `/incidents/${incident.id}`,
      { status },
      {
        only: ['active', 'openIncidents'],
        preserveScroll: true,
        preserveState: true,
      },
    );
}

function IncidentCard({
  incident,
  canMove,
}: {
  incident: IncidentRow;
  canMove: boolean;
}) {
  return (
    <Card
      withBorder
      padding="sm"
      draggable={canMove}
      onDragStart={(event: DragEvent) => {
        event.dataTransfer.setData(MIME, String(incident.id));
        event.dataTransfer.effectAllowed = 'move';
      }}
      style={{ cursor: canMove ? 'grab' : undefined }}
    >
      <Group justify="space-between" wrap="nowrap" align="flex-start" gap={4}>
        <Text
          component={Link}
          href={`/incidents/${incident.id}`}
          prefetch
          size="sm"
          fw={600}
          c="var(--mantine-color-text)"
          lineClamp={2}
          draggable={false}
        >
          <Text span inherit c="dimmed" fw={500}>
            {incident.reference}
          </Text>{' '}
          {incident.title}
        </Text>
        {canMove && (
          <Menu position="bottom-end" withinPortal>
            <Menu.Target>
              <ActionIcon
                variant="subtle"
                color="gray"
                size="sm"
                aria-label={`Move ${incident.reference}`}
              >
                <IconDots size={14} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Label>Move to</Menu.Label>
              {[...COLUMNS, 'resolved' as const]
                .filter((status) => status !== incident.status)
                .map((status) => (
                  <Menu.Item
                    key={status}
                    onClick={() => moveIncident(incident, status)}
                  >
                    {capitalize(status)}
                  </Menu.Item>
                ))}
            </Menu.Dropdown>
          </Menu>
        )}
      </Group>
      <Group justify="space-between" mt="xs" wrap="nowrap">
        <Text size="xs" c="dimmed" truncate>
          {relative(incident.declaredAt)} ·{' '}
          {incident.lead?.name ?? 'unassigned'}
        </Text>
        <SeverityBadge
          severity={incident.severity}
          size="xs"
          style={{ flexShrink: 0 }}
        />
      </Group>
    </Card>
  );
}

/** A column, or the resolve strip: somewhere to drop a card. */
function useDropTarget(
  active: IncidentRow[],
  status: IncidentStatus,
  enabled: boolean,
) {
  const [over, setOver] = useState(false);
  if (!enabled) return { over: false, handlers: {} };
  return {
    over,
    handlers: {
      onDragOver: (event: DragEvent) => {
        if (!event.dataTransfer.types.includes(MIME)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        setOver(true);
      },
      onDragLeave: () => setOver(false),
      onDrop: (event: DragEvent) => {
        event.preventDefault();
        setOver(false);
        const id = Number(event.dataTransfer.getData(MIME));
        const incident = active.find((i) => i.id === id);
        if (incident) moveIncident(incident, status);
      },
    },
  };
}

function Column({
  status,
  active,
  canMove,
}: {
  status: IncidentStatus;
  active: IncidentRow[];
  canMove: boolean;
}) {
  const { over, handlers } = useDropTarget(active, status, canMove);
  const incidents = active.filter((incident) => incident.status === status);
  return (
    <Stack
      gap="xs"
      p="xs"
      mih={140}
      {...handlers}
      style={{
        borderRadius: 'var(--mantine-radius-md)',
        background: 'var(--mantine-color-default-hover)',
        outline: over
          ? `2px dashed var(--mantine-color-${STATUS_COLOR[status]}-filled)`
          : '2px dashed transparent',
        transition: 'outline-color 120ms',
      }}
    >
      <Group gap={6} px={4}>
        <span
          aria-hidden
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            background: `var(--mantine-color-${STATUS_COLOR[status]}-filled)`,
          }}
        />
        <Text size="xs" fw={600} tt="uppercase" c="dimmed">
          {capitalize(status)}
        </Text>
        <Text size="xs" c="dimmed">
          {incidents.length}
        </Text>
      </Group>
      {incidents.map((incident) => (
        <IncidentCard key={incident.id} incident={incident} canMove={canMove} />
      ))}
    </Stack>
  );
}

function ResolveStrip({ active }: { active: IncidentRow[] }) {
  const { over, handlers } = useDropTarget(active, 'resolved', true);
  return (
    <Group
      {...handlers}
      justify="center"
      gap={6}
      mt="xs"
      py="sm"
      c={over ? undefined : 'dimmed'}
      style={{
        borderRadius: 'var(--mantine-radius-md)',
        border: `2px dashed ${
          over
            ? 'var(--mantine-color-green-filled)'
            : 'var(--mantine-color-default-border)'
        }`,
      }}
    >
      <IconCircleCheck size={16} />
      <Text size="sm">Drop here to resolve</Text>
    </Group>
  );
}

/** Active incidents by status. Responders drag a card to move it along. */
export function IncidentBoard({
  active,
  canMove,
}: {
  active: IncidentRow[];
  canMove: boolean;
}) {
  return (
    <>
      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="xs">
        {COLUMNS.map((status) => (
          <Column
            key={status}
            status={status}
            active={active}
            canMove={canMove}
          />
        ))}
      </SimpleGrid>
      {canMove && <ResolveStrip active={active} />}
    </>
  );
}
