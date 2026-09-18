import { Anchor, Card, Group, Stack, Text } from '@mantine/core';
import { Link } from 'nestjs-mvc/react';
import { PageHeader } from '../../components/PageHeader';
import { relative } from '../../lib/format';
import { appLayout } from '../../layouts/AppLayout';

interface Props {
  emails: {
    id: number;
    to: string;
    subject: string;
    body: string;
    links: { label: string; url: string }[];
    createdAt: string;
  }[];
}

/** The emails PagerPulse would have sent: the demo delivers them here. */
export default function Index({ emails }: Props) {
  return (
    <>
      <PageHeader
        title="Mailbox"
        description="PagerPulse sends no real email in this demo. What it would have sent lands here, links and all."
      />
      <Stack data-xray="emails">
        {emails.map((email) => (
          <Card key={email.id} withBorder padding="lg">
            <Group justify="space-between" mb={4}>
              <Text fw={600}>{email.subject}</Text>
              <Text size="xs" c="dimmed">
                {relative(email.createdAt)}
              </Text>
            </Group>
            <Text size="xs" c="dimmed" mb="sm">
              To {email.to}
            </Text>
            <Text size="sm" mb="sm" style={{ whiteSpace: 'pre-wrap' }}>
              {email.body}
            </Text>
            <Group gap="md">
              {email.links.map((link) => (
                <Anchor
                  key={link.url}
                  component={Link}
                  href={link.url}
                  size="sm"
                  title={link.url}
                >
                  {link.label}
                </Anchor>
              ))}
            </Group>
          </Card>
        ))}
        {emails.length === 0 && (
          <Text c="dimmed">
            Nothing yet. Subscribe on the status page to get the first one.
          </Text>
        )}
      </Stack>
    </>
  );
}

Index.layout = appLayout;
