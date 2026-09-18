import {
  Alert,
  Anchor,
  Badge,
  Button,
  Card,
  Grid,
  Group,
  Stack,
  Stepper,
  Text,
  Textarea,
  ThemeIcon,
  Title,
  Typography,
} from '@mantine/core';
import { IconCheck, IconLock } from '@tabler/icons-react';
import { Link, router, useForm } from 'nestjs-mvc/react';
import { useState } from 'react';
import { FollowUpItem } from '../../components/FollowUpItem';
import { PageHeader } from '../../components/PageHeader';
import { dateTime, relative } from '../../lib/format';
import { appLayout } from '../../layouts/AppLayout';
import type { FollowUpRow, IncidentRow, Person } from '../../types';

type Status = 'draft' | 'in_review' | 'published';

interface Content {
  summary: string;
  impact: string;
  rootCause: string;
  lessons: string;
}

interface Props {
  incident: IncidentRow;
  postMortem:
    | (Content & {
        status: Status;
        author: Person | null;
        updatedAt: string;
        publishedAt: string | null;
      })
    | null;
  followUps: FollowUpRow[];
  timeline?: { id: number; body: string; createdAt: string }[];
  canEdit: boolean;
  canPublish: boolean;
}

const SECTIONS: { key: keyof Content; label: string; hint: string }[] = [
  {
    key: 'summary',
    label: 'Summary',
    hint: 'What happened, in a few sentences anyone in the company can follow.',
  },
  {
    key: 'impact',
    label: 'Impact',
    hint: 'Who was affected, how badly, for how long.',
  },
  {
    key: 'rootCause',
    label: 'Root cause',
    hint: 'Why it happened. Keep asking why.',
  },
  {
    key: 'lessons',
    label: 'Lessons',
    hint: 'What changes so this does not happen again.',
  },
];

const STATUS_LABEL: Record<Status, string> = {
  draft: 'Draft',
  in_review: 'In review',
  published: 'Published',
};

function Editor({
  incident,
  postMortem,
}: Pick<Props, 'incident' | 'postMortem'>) {
  const base = `/incidents/${incident.id}/post-mortem`;
  // Precognitive: the form knows the submit endpoint, and validate() asks the
  // server whether a field would pass there, running the same Zod schema
  // through the same pipe as the real submit, without running the handler.
  const form = useForm('post', `${base}/submit`, {
    summary: postMortem?.summary ?? '',
    impact: postMortem?.impact ?? '',
    rootCause: postMortem?.rootCause ?? '',
    lessons: postMortem?.lessons ?? '',
  });

  return (
    <Card withBorder padding="lg">
      <Stack gap="lg">
        {SECTIONS.map(({ key, label, hint }) => (
          <Textarea
            key={key}
            label={
              <Group gap={6}>
                {label}
                {form.valid(key) && (
                  <ThemeIcon size={16} radius="xl" color="green">
                    <IconCheck size={11} />
                  </ThemeIcon>
                )}
              </Group>
            }
            description={hint}
            autosize
            minRows={3}
            value={form.data[key]}
            onChange={(e) => form.setData(key, e.currentTarget.value)}
            // Once a field was checked, keep checking it as the text changes.
            onBlur={() => form.validate(key)}
            onKeyUp={() => form.touched(key) && form.validate(key)}
            error={form.errors[key]}
          />
        ))}
        <Group justify="space-between">
          <Text size="xs" c="dimmed">
            {form.validating
              ? 'Checking…'
              : 'Checked against the review rules as you write.'}
          </Text>
          <Group gap="xs">
            <Button
              variant="default"
              loading={form.processing}
              // A draft takes anything: a different endpoint, a looser schema.
              onClick={() => form.put(base, { preserveScroll: true })}
            >
              Save draft
            </Button>
            <Button
              loading={form.processing}
              onClick={() => form.submit({ preserveScroll: true })}
            >
              Submit for review
            </Button>
          </Group>
        </Group>
      </Stack>
    </Card>
  );
}

function ReadOnly({
  postMortem,
}: {
  postMortem: NonNullable<Props['postMortem']>;
}) {
  return (
    <Card withBorder padding="lg">
      <Typography>
        {SECTIONS.map(({ key, label }) => (
          <div key={key}>
            <h4>{label}</h4>
            <p style={{ whiteSpace: 'pre-wrap' }}>
              {postMortem[key] || <em>Not written.</em>}
            </p>
          </div>
        ))}
      </Typography>
    </Card>
  );
}

function Timeline({
  incidentId,
  entries,
}: {
  incidentId: number;
  entries: Props['timeline'];
}) {
  const [loading, setLoading] = useState(false);
  if (!entries)
    return (
      <Button
        variant="subtle"
        size="xs"
        loading={loading}
        // An optional prop: asked for by name, so it only costs a query when
        // someone wants it.
        onClick={() =>
          router.reload({
            only: ['timeline'],
            onStart: () => setLoading(true),
            onFinish: () => setLoading(false),
          })
        }
      >
        Show the incident timeline
      </Button>
    );
  return (
    <Stack gap={6} data-xray="timeline">
      {entries.map((entry) => (
        <Text key={entry.id} size="xs">
          <Text span c="dimmed" size="xs">
            {dateTime(entry.createdAt)}
          </Text>{' '}
          {entry.body}
        </Text>
      ))}
      <Anchor
        component={Link}
        href={`/incidents/${incidentId}?tab=timeline`}
        size="xs"
      >
        Open on the incident
      </Anchor>
    </Stack>
  );
}

export default function Edit({
  incident,
  postMortem,
  followUps,
  timeline,
  canEdit,
  canPublish,
}: Props) {
  const status = postMortem?.status ?? 'draft';
  const resolved = incident.status === 'resolved';
  const openFollowUps = followUps.filter((f) => !f.completedAt).length;
  const step = !resolved
    ? 0
    : !postMortem
      ? 1
      : { draft: 1, in_review: 2, published: 4 }[status];

  return (
    <>
      <Anchor
        component={Link}
        href={`/incidents/${incident.id}`}
        size="sm"
        c="dimmed"
      >
        ← {incident.reference} {incident.title}
      </Anchor>
      <PageHeader
        title="Post-mortem"
        description={
          postMortem
            ? `${STATUS_LABEL[status]} · last edited ${relative(postMortem.updatedAt)}${postMortem.author ? ` · started by ${postMortem.author.name}` : ''}`
            : 'Not started yet.'
        }
        actions={
          <Group gap="xs">
            {incident.isPrivate && (
              <Badge
                color="grape"
                variant="light"
                leftSection={<IconLock size={12} />}
              >
                Private
              </Badge>
            )}
            <Badge
              variant="light"
              color={
                status === 'published'
                  ? 'green'
                  : status === 'in_review'
                    ? 'blue'
                    : 'gray'
              }
            >
              {STATUS_LABEL[status]}
            </Badge>
          </Group>
        }
      />

      <Grid gap="lg">
        <Grid.Col span={{ base: 12, md: 8 }}>
          <Stack>
            {!resolved && (
              <Alert color="yellow" title="Still ongoing">
                Post-incident starts once the incident is resolved.
              </Alert>
            )}
            {status === 'in_review' && (
              <Alert color="blue" title="In review" data-xray="postMortem">
                <Group justify="space-between" align="center">
                  <Text size="sm">
                    The incident lead or an admin publishes it, which closes the
                    incident.
                  </Text>
                  {canPublish && (
                    <Button
                      size="xs"
                      onClick={() =>
                        router.post(
                          `/incidents/${incident.id}/post-mortem/publish`,
                        )
                      }
                    >
                      Publish
                    </Button>
                  )}
                </Group>
              </Alert>
            )}
            {canEdit ? (
              <Editor incident={incident} postMortem={postMortem} />
            ) : postMortem ? (
              <ReadOnly postMortem={postMortem} />
            ) : (
              <Text c="dimmed">Nobody has written this post-mortem yet.</Text>
            )}
          </Stack>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 4 }}>
          <Stack>
            <Card withBorder padding="lg">
              <Title order={5} mb="md">
                Post-incident
              </Title>
              <Stepper active={step} orientation="vertical" size="sm">
                <Stepper.Step label="Resolve the incident" />
                <Stepper.Step
                  label="Write the post-mortem"
                  description="Documenting"
                />
                <Stepper.Step label="Review it" description="Reviewing" />
                <Stepper.Step
                  label="Publish"
                  description={
                    postMortem?.publishedAt
                      ? dateTime(postMortem.publishedAt)
                      : 'Closes the incident'
                  }
                />
              </Stepper>
            </Card>
            <Card withBorder padding="lg" data-xray="followUps">
              <Title order={5} mb="sm">
                Follow-ups
              </Title>
              <Text size="xs" c="dimmed" mb="sm">
                {openFollowUps
                  ? `${openFollowUps} still open: the actions this review should produce.`
                  : 'All done.'}
              </Text>
              <Stack gap="sm">
                {followUps.map((item) => (
                  <FollowUpItem
                    key={item.id}
                    item={item}
                    canRespond={canEdit}
                  />
                ))}
              </Stack>
            </Card>
            <Card withBorder padding="lg">
              <Title order={5} mb="sm">
                Timeline
              </Title>
              <Timeline incidentId={incident.id} entries={timeline} />
            </Card>
          </Stack>
        </Grid.Col>
      </Grid>
    </>
  );
}

Edit.layout = appLayout;
