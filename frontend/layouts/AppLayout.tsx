import {
  AppShell,
  Avatar,
  Badge,
  Burger,
  Button,
  Group,
  Menu,
  NavLink,
  Stack,
  Text,
  UnstyledButton,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  IconAlertTriangle,
  IconBellRinging,
  IconBolt,
  IconChecklist,
  IconExternalLink,
  IconFlame,
  IconLayoutDashboard,
  IconLogout,
  IconPhoneCall,
  IconPlus,
} from '@tabler/icons-react';
import { Link, router, usePage } from 'nestjs-mvc/react';
import type { ReactNode } from 'react';
import { ColorSchemeToggle } from '../components/ColorSchemeToggle';
import { PagingBanner } from '../components/PagingBanner';
import { Providers } from '../components/Providers';
import { capitalize } from '../lib/format';
import type { SharedProps } from '../types';
import { setXray } from '../xray/XrayOverlay';

const NAV = [
  { href: '/', label: 'Dashboard', icon: IconLayoutDashboard, exact: true },
  { href: '/incidents', label: 'Incidents', icon: IconAlertTriangle },
  { href: '/alerts', label: 'Alerts', icon: IconBellRinging },
  { href: '/follow-ups', label: 'Follow-ups', icon: IconChecklist },
  { href: '/on-call', label: 'On-call', icon: IconPhoneCall },
];

const initials = (name: string) =>
  name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2);

function Shell({ children }: { children: ReactNode }) {
  const { url, props } = usePage<SharedProps>();
  const [opened, { toggle, close }] = useDisclosure();
  const user = props.auth.user;
  const path = url.split('?')[0];
  const badges: Record<string, number | null | undefined> = {
    '/incidents': props.openIncidents,
    '/alerts': props.openAlerts,
  };

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{ width: 240, breakpoint: 'sm', collapsed: { mobile: !opened } }}
      padding="lg"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group gap="xs">
            <Burger
              opened={opened}
              onClick={toggle}
              hiddenFrom="sm"
              size="sm"
            />
            <IconFlame size={26} color="var(--mantine-color-indigo-6)" />
            <Text fw={700} size="lg">
              PagerPulse
            </Text>
          </Group>
          <Group gap="sm">
            {user && user.role !== 'viewer' && (
              <Button
                component={Link}
                href="/incidents/create"
                leftSection={<IconPlus size={16} />}
                visibleFrom="xs"
              >
                Declare incident
              </Button>
            )}
            <ColorSchemeToggle />
            {user && (
              <Menu position="bottom-end" width={220}>
                <Menu.Target>
                  <UnstyledButton aria-label="Account">
                    <Avatar color="gray" radius="xl">
                      {initials(user.name)}
                    </Avatar>
                  </UnstyledButton>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Label>
                    {user.name} · {capitalize(user.role)}
                  </Menu.Label>
                  <Menu.Item
                    leftSection={<IconBolt size={16} />}
                    rightSection={
                      <Text size="xs" c="dimmed">
                        Shift+X
                      </Text>
                    }
                    onClick={() => setXray(!props.__xray)}
                  >
                    {props.__xray ? 'Turn X-ray off' : 'Turn X-ray on'}
                  </Menu.Item>
                  <Menu.Divider />
                  <Menu.Item
                    leftSection={<IconLogout size={16} />}
                    onClick={() => router.post('/logout')}
                  >
                    Log out
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
            )}
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="sm">
        <Stack gap={4} style={{ flex: 1 }}>
          {NAV.map((item) => (
            <NavLink
              key={item.href}
              component={Link}
              href={item.href}
              onClick={close}
              label={item.label}
              leftSection={<item.icon size={18} stroke={1.6} />}
              active={
                item.exact ? path === item.href : path.startsWith(item.href)
              }
              rightSection={
                badges[item.href] ? (
                  <Badge
                    size="sm"
                    variant="light"
                    color="gray"
                    circle={(badges[item.href] ?? 0) < 10}
                  >
                    {badges[item.href]}
                  </Badge>
                ) : null
              }
            />
          ))}
        </Stack>
        <NavLink
          href="/status"
          target="_blank"
          label="Public status page"
          leftSection={<IconExternalLink size={18} stroke={1.6} />}
        />
      </AppShell.Navbar>

      <AppShell.Main>
        <PagingBanner />
        {children}
      </AppShell.Main>
    </AppShell>
  );
}

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <Providers>
      <Shell>{children}</Shell>
    </Providers>
  );
}

/** For `Page.layout = appLayout`. */
export const appLayout = (page: ReactNode) => <AppLayout>{page}</AppLayout>;
