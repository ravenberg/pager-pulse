import { Alert, Anchor, Button, Group, Stack, Text } from '@mantine/core';
import { IconSpeakerphone } from '@tabler/icons-react';
import { Link, router, usePage } from 'nestjs-mvc/react';
import { relative } from '../lib/format';
import type { SharedProps } from '../types';

/**
 * "You are being paged", on every page. The `paging` prop is shared with
 * always(), so the polls of whatever page is open refresh it too.
 */
export function PagingBanner() {
  const { props } = usePage<SharedProps>();
  const paging = props.paging ?? [];
  if (!paging.length) return null;

  return (
    <Stack gap="xs" mb="lg" data-xray="paging">
      {paging.map((page) => (
        <Alert
          key={page.id}
          color="red"
          variant="filled"
          icon={<IconSpeakerphone size={18} />}
          title="You are being paged"
        >
          <Group justify="space-between" wrap="nowrap" align="flex-end">
            <Text size="sm">
              {page.reason}
              {page.incident && (
                <>
                  {' · '}
                  <Anchor
                    component={Link}
                    href={`/incidents/${page.incident.id}`}
                    c="white"
                    underline="always"
                    size="sm"
                  >
                    {page.incident.reference}
                  </Anchor>
                </>
              )}
              {` · ${page.path}, level ${page.level} of ${page.levels}`}
              {page.escalatesAt && ` · escalates ${relative(page.escalatesAt)}`}
            </Text>
            <Button
              size="xs"
              variant="white"
              color="red"
              onClick={() =>
                router.post(
                  `/escalations/${page.id}/acknowledge`,
                  {},
                  { preserveScroll: true },
                )
              }
            >
              Acknowledge
            </Button>
          </Group>
        </Alert>
      ))}
    </Stack>
  );
}
