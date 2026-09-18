import {
  Anchor,
  Badge,
  Card,
  Code,
  Group,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Title,
  Tooltip,
} from '@mantine/core';
import { Link } from 'nestjs-mvc/react';
import { PageHeader } from '../components/PageHeader';
import { appLayout } from '../layouts/AppLayout';
import { routeFeatures } from '../xray/detect';
import {
  FEATURES,
  type Feature,
  type FeatureKey,
  KITCHEN_SINK,
} from '../xray/features';
import { setXray } from '../xray/XrayOverlay';
import type { CatalogRoute } from '../xray/types';

interface Props {
  routes: CatalogRoute[];
}

/** Found in the request log, not in anything the server knows about a route. */
const CLIENT_ONLY: FeatureKey[] = [
  'partial-reload',
  'poll',
  'prefetch',
  'precognition',
  'error-bag',
];

function FeatureBadge({ featureKey }: { featureKey: FeatureKey }) {
  const feature = FEATURES[featureKey];
  return (
    <Tooltip label={feature.blurb} multiline w={280} withArrow>
      <Badge size="sm" variant="light" color={feature.color} tt="none">
        {feature.title}
      </Badge>
    </Tooltip>
  );
}

function RouteRow({ route }: { route: CatalogRoute }) {
  const found = routeFeatures(route, route.props, route.flash);
  // On every page; the counts at the top say so once.
  found.delete('view');
  found.delete('shared');
  found.delete('auth-redirect');
  const keys = (Object.keys(FEATURES) as FeatureKey[]).filter((key) =>
    found.has(key),
  );
  const visitable =
    route.view && route.method === 'GET' && !route.path.includes(':');

  return (
    <Table.Tr>
      <Table.Td>
        <Text size="xs" ff="monospace" fw={600}>
          {route.method}{' '}
          {visitable ? (
            <Anchor component={Link} href={route.path} size="xs" ff="monospace">
              {route.path}
            </Anchor>
          ) : (
            route.path
          )}
        </Text>
        <Text size="xs" c="dimmed">
          {route.handler}
          {route.view && (
            <>
              {' → '}
              <Code fz="xs">{route.view}</Code>
            </>
          )}
        </Text>
      </Table.Td>
      <Table.Td>
        <Group gap={4}>
          {keys.map((key) => (
            <FeatureBadge key={key} featureKey={key} />
          ))}
          {route.view && route.props === null && (
            <Text size="xs" c="dimmed" fs="italic">
              Props show up once the page has been visited
            </Text>
          )}
        </Group>
      </Table.Td>
    </Table.Tr>
  );
}

export default function Showcase({ routes }: Props) {
  const usage = new Map<FeatureKey, number>();
  for (const route of routes) {
    for (const key of routeFeatures(route, route.props, route.flash).keys())
      usage.set(key, (usage.get(key) ?? 0) + 1);
  }
  const unused = (Object.entries(FEATURES) as [FeatureKey, Feature][]).filter(
    ([key]) => !usage.has(key) && !CLIENT_ONLY.includes(key),
  );
  const pages = routes.filter((route) => route.view);
  const unvisited = pages.filter((route) => route.props === null).length;
  const actions = routes.filter((route) => !route.view);

  return (
    <>
      <PageHeader
        title="Showcase"
        description={
          <>
            Every route in PagerPulse and the nestjs-mvc features it uses, read
            from decorators and from what each handler returns. Turn on{' '}
            <Anchor component="button" size="sm" onClick={() => setXray(true)}>
              X-ray
            </Anchor>{' '}
            (Shift+X) to see them on the page itself.
          </>
        }
      />

      <SimpleGrid cols={{ base: 1, md: 2 }} mb="xl">
        <Card withBorder>
          <Title order={5} mb="sm">
            In use
          </Title>
          <Group gap={6}>
            {(Object.keys(FEATURES) as FeatureKey[])
              .filter((key) => usage.has(key))
              .map((key) => (
                <Group key={key} gap={4}>
                  <FeatureBadge featureKey={key} />
                  <Text size="xs" c="dimmed">
                    ×{usage.get(key)}
                  </Text>
                </Group>
              ))}
          </Group>
          <Text size="xs" c="dimmed" mt="sm">
            Seen in the browser rather than on a route:{' '}
            {CLIENT_ONLY.map((key) => FEATURES[key].title).join(', ')}. X-ray
            lists them under Requests.
          </Text>
        </Card>
        <Card withBorder>
          <Title order={5} mb="sm">
            Not shown yet
          </Title>
          <Stack gap={6}>
            {unused.map(([key, feature]) => (
              <Group key={key} justify="space-between" wrap="nowrap">
                <FeatureBadge featureKey={key} />
                <Text size="xs" c="dimmed">
                  {feature.planned ?? '—'}
                </Text>
              </Group>
            ))}
          </Stack>
          {unvisited > 0 && (
            <Text size="xs" c="dimmed" mt="sm">
              {unvisited} {unvisited === 1 ? 'page has' : 'pages have'} not been
              visited since the server started, and actions show flash messages
              only once they have run. Props and flashes are seen at runtime, so
              this list shrinks as you click around.
            </Text>
          )}
        </Card>
      </SimpleGrid>

      <Title order={4} mb="sm">
        Pages
      </Title>
      <Card withBorder p={0} mb="xl">
        <Table verticalSpacing="sm" horizontalSpacing="md">
          <Table.Tbody>
            {pages.map((route) => (
              <RouteRow key={route.handler} route={route} />
            ))}
          </Table.Tbody>
        </Table>
      </Card>

      <Title order={4} mb="sm">
        Actions
      </Title>
      <Card withBorder p={0} mb="md">
        <Table verticalSpacing="sm" horizontalSpacing="md">
          <Table.Tbody>
            {actions.map((route) => (
              <RouteRow key={route.handler} route={route} />
            ))}
          </Table.Tbody>
        </Table>
      </Card>
      <Text size="xs" c="dimmed">
        Flash messages appear on an action once it has run. More on each feature
        in the{' '}
        <Anchor href={KITCHEN_SINK} target="_blank" size="xs">
          nestjs-mvc kitchen sink
        </Anchor>
        .
      </Text>
    </>
  );
}

Showcase.layout = appLayout;
