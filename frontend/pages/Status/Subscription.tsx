import { Anchor, Button, Card, Stack, Text, Title } from '@mantine/core';
import { Head, Link, router } from 'nestjs-mvc/react';
import { Illustration } from '../../components/Illustration';
import { statusLayout } from '../../layouts/StatusLayout';

type State = 'confirmed' | 'already' | 'expired' | 'invalid' | 'unsubscribe';

interface Props {
  state: State;
  email: string;
  unsubscribeUrl?: string;
  /** The signed URL to post the unsubscribe to. */
  action?: string;
}

const COPY: Record<State, { title: string; body: (email: string) => string }> =
  {
    confirmed: {
      title: 'You are subscribed',
      body: (email) => `We will email ${email} whenever we post an update.`,
    },
    already: {
      title: 'Already confirmed',
      body: (email) =>
        `${email} is subscribed. Each confirmation link works once.`,
    },
    expired: {
      title: 'This link has expired',
      body: () =>
        'Confirmation links work for a day. Subscribe again for a new one.',
    },
    invalid: {
      title: 'This link does not work',
      body: () =>
        'It was changed or copied incompletely. Subscribe again for a new one.',
    },
    unsubscribe: {
      title: 'Unsubscribe?',
      body: (email) => `${email} will get no more status emails from us.`,
    },
  };

/** Where the links from our emails land. Signed, so they need no login. */
export default function Subscription({
  state,
  email,
  unsubscribeUrl,
  action,
}: Props) {
  const copy = COPY[state];
  return (
    <Card withBorder padding="xl" radius="lg" maw={520} mx="auto">
      <Head title={`${copy.title} · PagerPulse status`} />
      <Stack gap="sm">
        {(state === 'confirmed' || state === 'already') && (
          <Illustration name="mail-sent" width={180} />
        )}
        <Title order={3}>{copy.title}</Title>
        <Text>{copy.body(email)}</Text>
        {state === 'unsubscribe' && action && (
          <Button
            color="red"
            onClick={() => router.post(action)}
            w="fit-content"
          >
            Unsubscribe
          </Button>
        )}
        {unsubscribeUrl && (
          <Text size="sm" c="dimmed">
            Changed your mind?{' '}
            <Anchor component={Link} href={unsubscribeUrl} size="sm">
              Unsubscribe
            </Anchor>
          </Text>
        )}
        <Anchor component={Link} href="/status" size="sm">
          To the status page
        </Anchor>
      </Stack>
    </Card>
  );
}

Subscription.layout = statusLayout;
