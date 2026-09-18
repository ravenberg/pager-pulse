import { z } from 'zod';
import { SEVERITIES } from '../database/entities/index.js';

/** What a monitoring tool posts to /alerts/ingest. */
export const IngestSchema = z.object({
  title: z
    .string('An alert needs a title.')
    .trim()
    .min(1, 'An alert needs a title.')
    .max(200),
  description: z.string().trim().max(5000).default(''),
  severity: z.enum(SEVERITIES).default('major'),
  status: z.enum(['firing', 'resolved']).default('firing'),
  /** Alerts with the same key are one alert while it is open. */
  dedupKey: z.string().trim().min(1).max(200).optional(),
  labels: z.record(z.string(), z.coerce.string()).default({}),
});

export type IngestPayload = z.infer<typeof IngestSchema>;

export const SourceSchema = z.object({
  name: z.string().trim().min(2, 'Give the source a name.').max(80),
  serviceId: z.coerce.number().int().positive().nullable().default(null),
});
