import {
  Group,
  Kbd,
  Loader,
  Modal,
  ScrollArea,
  Stack,
  Text,
  TextInput,
  UnstyledButton,
} from '@mantine/core';
import { useDebouncedValue, useHotkeys } from '@mantine/hooks';
import {
  IconAlertTriangle,
  IconArrowRight,
  IconPlus,
  IconSearch,
  IconServer,
} from '@tabler/icons-react';
import { router, useHttp, usePage } from 'nestjs-mvc/react';
import {
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { IncidentStatus, Severity, SharedProps } from '../types';
import { SeverityBadge, StatusBadge } from './Badges';

interface SearchResults {
  incidents: {
    id: number;
    reference: string;
    title: string;
    severity: Severity;
    status: IncidentStatus;
  }[];
  services: { id: number; name: string; team: string | null }[];
}

interface Item {
  key: string;
  group: string;
  label: ReactNode;
  icon: ReactNode;
  right?: ReactNode;
  href: string;
  /** Words the item answers to when it is not a search result. */
  words?: string;
}

const PAGES: [string, string][] = [
  ['Dashboard', '/'],
  ['Incidents', '/incidents'],
  ['Alerts', '/alerts'],
  ['Follow-ups', '/follow-ups'],
  ['On-call', '/on-call'],
  ['Catalog', '/catalog'],
];

let openPalette: () => void = () => {};

/** Opens the palette from anywhere, e.g. the search button in the header. */
export const showCommandPalette = () => openPalette();

/**
 * Cmd+K. Typing asks GET /search with useHttp: a plain JSON request, so the
 * page, its props and the history stay as they are. Choosing a result is an
 * ordinary visit.
 */
export function CommandPalette() {
  const { props } = usePage<SharedProps>();
  const [opened, setOpened] = useState(false);
  const [active, setActive] = useState(0);
  const search = useHttp<{ q: string }, SearchResults>({ q: '' });
  const [q] = useDebouncedValue(search.data.q.trim(), 150);

  openPalette = () => setOpened(true);
  useHotkeys([['mod+K', () => setOpened((o) => !o)]], [], true);

  useEffect(() => {
    if (!q) return;
    search.cancel();
    search.get('/search').catch(() => {
      // Cancelled by the next keystroke, or offline: keep the last results.
    });
  }, [q]);

  const items = useMemo<Item[]>(() => {
    const typed = search.data.q.trim().toLowerCase();
    const commands: Item[] = [
      ...(props.auth.user?.role !== 'viewer'
        ? [
            {
              key: 'declare',
              group: 'Actions',
              label: 'Declare incident',
              icon: <IconPlus size={16} />,
              href: '/incidents/create',
              words: 'declare new incident create',
            },
          ]
        : []),
      ...PAGES.map(([label, href]) => ({
        key: href,
        group: 'Go to',
        label,
        icon: <IconArrowRight size={16} />,
        href,
        words: label.toLowerCase(),
      })),
    ].filter((item) => !typed || item.words.includes(typed));

    const results = q ? search.response : null;
    return [
      ...(results?.incidents ?? []).map((incident) => ({
        key: `incident-${incident.id}`,
        group: 'Incidents',
        label: (
          <>
            <Text span c="dimmed" size="sm" mr={6}>
              {incident.reference}
            </Text>
            {incident.title}
          </>
        ),
        icon: <IconAlertTriangle size={16} />,
        right: (
          <Group gap={6} wrap="nowrap">
            <SeverityBadge severity={incident.severity} size="sm" />
            <StatusBadge status={incident.status} size="sm" />
          </Group>
        ),
        href: `/incidents/${incident.id}`,
      })),
      ...(results?.services ?? []).map((service) => ({
        key: `service-${service.id}`,
        group: 'Services',
        label: service.name,
        icon: <IconServer size={16} />,
        right: service.team && (
          <Text size="xs" c="dimmed">
            {service.team}
          </Text>
        ),
        href: '/catalog',
      })),
      ...commands,
    ];
  }, [q, search.data.q, search.response, props.auth.user?.role]);

  useEffect(() => setActive(0), [items.length, q]);

  function close() {
    setOpened(false);
    search.reset();
  }

  function choose(item: Item | undefined) {
    if (!item) return;
    close();
    router.visit(item.href);
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActive((i) => (i + step + items.length) % Math.max(items.length, 1));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      choose(items[active]);
    }
  }

  const searching = search.processing || q !== search.data.q.trim();
  let lastGroup = '';

  return (
    <Modal
      opened={opened}
      onClose={close}
      withCloseButton={false}
      padding={0}
      size="lg"
      yOffset="12vh"
      aria-label="Search"
    >
      <TextInput
        data-autofocus
        size="md"
        variant="unstyled"
        px="md"
        py={6}
        placeholder="Search incidents and services, or jump to a page…"
        leftSection={<IconSearch size={18} />}
        rightSection={searching && q ? <Loader size="xs" /> : null}
        value={search.data.q}
        onChange={(e) => search.setData('q', e.currentTarget.value)}
        onKeyDown={onKeyDown}
        style={{
          borderBottom: '1px solid var(--mantine-color-default-border)',
        }}
      />
      <ScrollArea.Autosize mah="55vh" type="auto">
        <Stack gap={0} p={6} role="listbox">
          {items.map((item, index) => {
            const heading = item.group !== lastGroup;
            lastGroup = item.group;
            return (
              <div key={item.key}>
                {heading && (
                  <Text size="xs" fw={600} c="dimmed" px="sm" pt="sm" pb={4}>
                    {item.group}
                  </Text>
                )}
                <UnstyledButton
                  role="option"
                  aria-selected={index === active}
                  w="100%"
                  px="sm"
                  py={8}
                  onMouseMove={() => setActive(index)}
                  onClick={() => choose(item)}
                  style={{
                    borderRadius: 'var(--mantine-radius-sm)',
                    background:
                      index === active
                        ? 'var(--mantine-color-default-hover)'
                        : undefined,
                  }}
                >
                  <Group gap="sm" wrap="nowrap" justify="space-between">
                    <Group gap="sm" wrap="nowrap" miw={0}>
                      <Text c="dimmed" component="span" display="flex">
                        {item.icon}
                      </Text>
                      <Text size="sm" truncate>
                        {item.label}
                      </Text>
                    </Group>
                    {item.right}
                  </Group>
                </UnstyledButton>
              </div>
            );
          })}
          {items.length === 0 && !searching && (
            <Text size="sm" c="dimmed" ta="center" py="xl">
              Nothing matches “{search.data.q.trim()}”.
            </Text>
          )}
        </Stack>
      </ScrollArea.Autosize>
      <Group
        gap="md"
        px="md"
        py={8}
        c="dimmed"
        style={{ borderTop: '1px solid var(--mantine-color-default-border)' }}
      >
        <Text size="xs">
          <Kbd size="xs">↑</Kbd> <Kbd size="xs">↓</Kbd> to move
        </Text>
        <Text size="xs">
          <Kbd size="xs">↵</Kbd> to open
        </Text>
        <Text size="xs">
          <Kbd size="xs">esc</Kbd> to close
        </Text>
      </Group>
    </Modal>
  );
}
