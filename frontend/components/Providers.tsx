import { MantineProvider } from '@mantine/core';
import { Notifications, notifications } from '@mantine/notifications';
import { usePage } from 'nestjs-mvc/react';
import { type ReactNode, useEffect } from 'react';
import { theme } from '../lib/theme';
import { XrayOverlay, XrayShortcut } from '../xray/XrayOverlay';

/** Shows each flash message once, as a toast. */
function FlashToasts() {
  const { flash } = usePage();
  useEffect(() => {
    const success = flash?.success as string | undefined;
    const error = flash?.error as string | undefined;
    if (success) notifications.show({ message: success, color: 'green' });
    if (error) notifications.show({ message: error, color: 'red' });
  }, [flash]);
  return null;
}

/**
 * Mantine around every page. There is no main.tsx (nestjsMvc() generates the
 * entry), so each layout mounts this; layouts persist across visits, so it
 * mounts once.
 */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <MantineProvider theme={theme} defaultColorScheme="auto">
      <Notifications position="top-right" />
      <FlashToasts />
      <XrayShortcut />
      {children}
      <XrayOverlay />
    </MantineProvider>
  );
}
