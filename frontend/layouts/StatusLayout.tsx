import { Anchor, Box, Container, Group, Text } from '@mantine/core';
import { IconFlame } from '@tabler/icons-react';
import { Link } from 'nestjs-mvc/react';
import type { ReactNode } from 'react';
import { Providers } from '../components/Providers';

export function StatusLayout({ children }: { children: ReactNode }) {
  return (
    <Providers>
      <Box bg="var(--mantine-color-gray-light)" mih="100vh" py={48}>
        <Container size="md">
          <Group justify="space-between" mb="xl">
            <Anchor
              component={Link}
              href="/status"
              underline="never"
              c="inherit"
            >
              <Group gap="xs">
                <IconFlame size={28} color="var(--mantine-color-indigo-6)" />
                <Text fw={700} size="xl">
                  PagerPulse status
                </Text>
              </Group>
            </Anchor>
          </Group>
          {children}
        </Container>
      </Box>
    </Providers>
  );
}

export const statusLayout = (page: ReactNode) => (
  <StatusLayout>{page}</StatusLayout>
);
