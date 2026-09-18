import { Center, Container, Group, Text } from '@mantine/core';
import { IconFlame } from '@tabler/icons-react';
import type { ReactNode } from 'react';
import { Providers } from '../components/Providers';

export function GuestLayout({ children }: { children: ReactNode }) {
  return (
    <Providers>
      <Center mih="100vh" bg="var(--mantine-color-gray-light)">
        <Container size={420} w="100%">
          <Group justify="center" gap="xs" mb="lg">
            <IconFlame size={32} color="var(--mantine-color-indigo-6)" />
            <Text fw={700} size="xl">
              PagerPulse
            </Text>
          </Group>
          {children}
        </Container>
      </Center>
    </Providers>
  );
}

export const guestLayout = (page: ReactNode) => (
  <GuestLayout>{page}</GuestLayout>
);
