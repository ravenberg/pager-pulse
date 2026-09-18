import {
  ActionIcon,
  Anchor,
  Badge,
  Button,
  Code,
  Drawer,
  Group,
  Paper,
  ScrollArea,
  Stack,
  Table,
  Tabs,
  Text,
  Tooltip,
} from '@mantine/core';
import { IconBolt, IconTrash, IconX } from '@tabler/icons-react';
import { Link, router, usePage } from 'nestjs-mvc/react';
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { type Evidence, ordered, pageFeatures, requestsOnPage } from './detect';
import { KITCHEN_SINK } from './features';
import {
  installRequestLog,
  type RequestEntry,
  type RequestKind,
  requestLog,
} from './requestLog';
import type { PropKind, XrayReport } from './types';

export const setXray = (enabled: boolean) =>
  router.post('/xray', { enabled }, { preserveScroll: true });

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable ||
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

/** Shift+X turns X-ray on or off, on every layout. */
export function XrayShortcut() {
  const { props } = usePage();
  const enabled = !!props.__xray;
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.shiftKey && event.key === 'X' && !isTyping(event.target))
        setXray(!enabled);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled]);
  return null;
}

/** Outlines the elements on the page that render a prop (`data-xray="stats"`). */
function highlight(
  prop: string | undefined,
  on: boolean,
  attribute = 'data-xray-hit',
) {
  if (!prop) return;
  document
    .querySelectorAll(`[data-xray~="${CSS.escape(prop)}"]`)
    .forEach((element) =>
      on
        ? element.setAttribute(attribute, '')
        : element.removeAttribute(attribute),
    );
}

/** Briefly pulses what a partial reload, poll or deferred request just refreshed. */
function usePulse(entries: RequestEntry[]) {
  const seen = useMemo(() => new Set<string>(), []);
  useEffect(() => {
    for (const entry of entries) {
      if (entry.outcome !== 'ok' || seen.has(entry.id)) continue;
      seen.add(entry.id);
      if (!['partial', 'poll', 'deferred', 'scroll'].includes(entry.kind))
        continue;
      for (const prop of entry.only) {
        highlight(prop, true, 'data-xray-pulse');
        setTimeout(() => highlight(prop, false, 'data-xray-pulse'), 900);
      }
    }
  }, [entries, seen]);
}

const KIND_COLOR: Record<PropKind, string> = {
  eager: 'gray',
  lazy: 'blue',
  defer: 'indigo',
  optional: 'violet',
  always: 'pink',
  merge: 'teal',
  prepend: 'teal',
  'deep-merge': 'teal',
  scroll: 'cyan',
  once: 'lime',
};

const REQUEST_COLOR: Record<RequestKind, string> = {
  load: 'gray',
  visit: 'gray',
  partial: 'blue',
  poll: 'cyan',
  deferred: 'indigo',
  scroll: 'teal',
  prefetch: 'lime',
  cached: 'lime',
  mutation: 'orange',
};

const kb = (bytes: number | null) =>
  bytes === null ? '' : `${(bytes / 1024).toFixed(1)} kB`;

const time = (at: number) =>
  new Date(at).toLocaleTimeString(undefined, { hour12: false });

function EvidenceChip({ evidence }: { evidence: Evidence }) {
  return (
    <Badge
      variant="light"
      color="gray"
      tt="none"
      fw={500}
      style={{ cursor: evidence.prop ? 'crosshair' : undefined }}
      onMouseEnter={() => highlight(evidence.prop, true)}
      onMouseLeave={() => highlight(evidence.prop, false)}
    >
      {evidence.label}
    </Badge>
  );
}

function FeaturesTab({
  features,
  component,
}: {
  features: ReturnType<typeof ordered>;
  component: string;
}) {
  return (
    <Stack gap="sm">
      {features.map(({ key, feature, evidence }) => (
        <Paper key={key} withBorder p="sm">
          <Group justify="space-between" gap="xs" mb={4}>
            <Text fw={600} size="sm">
              {feature.title}
            </Text>
            <Badge size="xs" variant="dot" color={feature.color}>
              {feature.group}
            </Badge>
          </Group>
          <Code block mb={6} fz="xs">
            {feature.code.replace('$view', component)}
          </Code>
          <Text size="xs" c="dimmed" mb={evidence.length ? 6 : 0}>
            {feature.blurb}
          </Text>
          {evidence.length > 0 && (
            <Group gap={4}>
              {evidence.map((e) => (
                <EvidenceChip key={e.label} evidence={e} />
              ))}
            </Group>
          )}
        </Paper>
      ))}
    </Stack>
  );
}

function PropsTab({
  report,
  loaded,
}: {
  report: XrayReport;
  loaded: Record<string, unknown>;
}) {
  const size = (key: string) =>
    key in loaded ? JSON.stringify(loaded[key] ?? null).length : null;
  return (
    <Stack gap="md">
      <Table fz="xs" verticalSpacing={4} highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Prop</Table.Th>
            <Table.Th>Kind</Table.Th>
            <Table.Th ta="right">On page</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {report.props.map((prop) => {
            const top = prop.path.split('.')[0];
            const bytes = size(top);
            return (
              <Table.Tr
                key={prop.path}
                onMouseEnter={() => highlight(top, true)}
                onMouseLeave={() => highlight(top, false)}
              >
                <Table.Td>
                  <Code fz="xs">{prop.path}</Code>
                  {prop.detail && (
                    <Text span size="xs" c="dimmed" ml={6}>
                      {prop.detail}
                    </Text>
                  )}
                </Table.Td>
                <Table.Td>
                  <Badge
                    size="xs"
                    color={KIND_COLOR[prop.kind]}
                    variant="light"
                  >
                    {prop.kind}
                  </Badge>
                </Table.Td>
                <Table.Td ta="right" c={bytes === null ? 'dimmed' : undefined}>
                  {bytes === null ? 'not loaded' : kb(bytes)}
                </Table.Td>
              </Table.Tr>
            );
          })}
        </Table.Tbody>
      </Table>
      <Text size="xs" c="dimmed">
        Shared with every page:{' '}
        {report.shared.map((key) => (
          <Code key={key} fz="xs" mr={4}>
            {key}
          </Code>
        ))}
      </Text>
      {report.actions.length > 0 && (
        <Stack gap={4}>
          <Text size="xs" fw={600}>
            Forms on this page post to {report.route.handler.split('#')[0]}
          </Text>
          {report.actions.map((action) => (
            <Text key={action.handler} size="xs">
              <Code fz="xs">
                {action.method} {action.path}
              </Code>{' '}
              <Text span c="dimmed" size="xs">
                {action.roles.length ? action.roles.join('/') : 'any user'}
                {action.schema && ` · validates ${action.schema.join(', ')}`}
              </Text>
            </Text>
          ))}
        </Stack>
      )}
    </Stack>
  );
}

function RequestsTab({ entries }: { entries: RequestEntry[] }) {
  if (!entries.length)
    return (
      <Text size="sm" c="dimmed">
        No requests yet.
      </Text>
    );
  return (
    <Stack gap={6}>
      {entries.map((entry) => (
        <Paper
          key={entry.id}
          withBorder
          px="xs"
          py={6}
          onMouseEnter={() => entry.only.forEach((p) => highlight(p, true))}
          onMouseLeave={() => entry.only.forEach((p) => highlight(p, false))}
        >
          <Group justify="space-between" gap="xs" wrap="nowrap">
            <Group gap={6} wrap="nowrap" style={{ minWidth: 0 }}>
              <Badge
                size="xs"
                w={72}
                color={REQUEST_COLOR[entry.kind]}
                variant={entry.outcome === 'pending' ? 'outline' : 'light'}
              >
                {entry.kind}
              </Badge>
              <Text size="xs" ff="monospace" truncate>
                {entry.method.toUpperCase()} {entry.url}
              </Text>
            </Group>
            <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
              {entry.outcome === 'errors'
                ? 'errors · '
                : entry.outcome === 'cancelled'
                  ? 'cancelled · '
                  : ''}
              {entry.ms !== null && `${entry.ms} ms`}
              {entry.bytes ? ` · ${kb(entry.bytes)}` : ''}
            </Text>
          </Group>
          {(entry.only.length > 0 || entry.except.length > 0) && (
            <Text size="xs" c="dimmed" mt={2} ff="monospace">
              {entry.only.length > 0 && `only: ${entry.only.join(', ')}`}
              {entry.except.length > 0 && ` except: ${entry.except.join(', ')}`}
              {entry.every && ` · every ~${entry.every}s`}
            </Text>
          )}
          <Text size="xs" c="dimmed" mt={2}>
            {time(entry.at)}
          </Text>
        </Paper>
      ))}
    </Stack>
  );
}

/**
 * The X-ray overlay: which nestjs-mvc features this page uses and what goes
 * over the wire. Renders only when the server sent `__xray`, i.e. X-ray is on.
 */
export function XrayOverlay() {
  const page = usePage();
  const report = page.props.__xray as XrayReport | undefined;
  const [mounted, setMounted] = useState(false);
  const [opened, setOpened] = useState(false);
  const [tab, setTab] = useState<string | null>('features');
  const entries = useSyncExternalStore(
    requestLog.subscribe,
    requestLog.snapshot,
    () => [],
  );

  useEffect(() => {
    if (!report) return;
    installRequestLog(page.url);
    setMounted(true);
  }, [report, page.url]);
  usePulse(entries);

  const onPage = useMemo(
    () => requestsOnPage(entries, page.url),
    [entries, page.url],
  );
  const features = useMemo(
    () => (report ? ordered(pageFeatures(report, page, onPage)) : []),
    [report, page, onPage],
  );

  // Rendered after hydration only: a server-rendered page must match its HTML.
  if (!report || !mounted) return null;

  return (
    <>
      {!opened && (
        <Button
          onClick={() => setOpened(true)}
          leftSection={<IconBolt size={16} />}
          variant="filled"
          color="dark"
          radius="xl"
          size="sm"
          style={{
            position: 'fixed',
            right: 16,
            bottom: 16,
            zIndex: 300,
            boxShadow: 'var(--mantine-shadow-md)',
          }}
        >
          X-ray · {features.length} features
        </Button>
      )}

      <Drawer
        opened={opened}
        onClose={() => setOpened(false)}
        position="right"
        size={460}
        withOverlay={false}
        lockScroll={false}
        trapFocus={false}
        padding="md"
        title={
          <Stack gap={0}>
            <Group gap={6}>
              <IconBolt size={18} />
              <Text fw={700}>X-ray</Text>
              <Code fz="xs">{page.component}</Code>
            </Group>
            <Text size="xs" c="dimmed" ff="monospace">
              {report.route.method} {report.route.path} → {report.route.handler}{' '}
              · {report.request.handlerMs} ms
              {report.request.ssr && ' · server-rendered'}
            </Text>
          </Stack>
        }
        styles={{ body: { paddingTop: 0 } }}
      >
        <Tabs value={tab} onChange={setTab}>
          <Tabs.List mb="sm">
            <Tabs.Tab value="features">This page ({features.length})</Tabs.Tab>
            <Tabs.Tab value="props">Props ({report.props.length})</Tabs.Tab>
            <Tabs.Tab
              value="requests"
              rightSection={
                tab === 'requests' ? (
                  <Tooltip label="Clear">
                    <ActionIcon
                      component="span"
                      size="xs"
                      variant="subtle"
                      color="gray"
                      onClick={(event) => {
                        event.stopPropagation();
                        requestLog.clear();
                      }}
                    >
                      <IconTrash size={12} />
                    </ActionIcon>
                  </Tooltip>
                ) : undefined
              }
            >
              Requests ({entries.length})
            </Tabs.Tab>
          </Tabs.List>

          <ScrollArea.Autosize mah="calc(100vh - 190px)" offsetScrollbars>
            <Tabs.Panel value="features">
              <FeaturesTab features={features} component={page.component} />
            </Tabs.Panel>
            <Tabs.Panel value="props">
              <PropsTab report={report} loaded={page.props} />
            </Tabs.Panel>
            <Tabs.Panel value="requests">
              <RequestsTab entries={entries} />
            </Tabs.Panel>
          </ScrollArea.Autosize>
        </Tabs>

        <Group justify="space-between" mt="sm">
          <Group gap="md">
            <Anchor component={Link} href="/showcase" size="xs">
              All routes
            </Anchor>
            <Anchor href={KITCHEN_SINK} target="_blank" size="xs">
              Kitchen sink
            </Anchor>
          </Group>
          <Button
            size="compact-xs"
            variant="subtle"
            color="gray"
            leftSection={<IconX size={12} />}
            onClick={() => setXray(false)}
          >
            Turn off (Shift+X)
          </Button>
        </Group>
      </Drawer>
    </>
  );
}
