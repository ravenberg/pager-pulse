import { z } from 'zod';
import { SEVERITIES, STATUSES } from '../database/entities/index.js';

const userId = z.coerce.number().int().positive().nullable();

export const DeclareSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, 'Give the incident a title of at least 3 characters.')
    .max(120),
  summary: z.string().trim().max(2000).default(''),
  severity: z.enum(SEVERITIES, 'Pick a severity.'),
  serviceIds: z.array(z.coerce.number().int().positive()).default([]),
  leadId: userId.default(null),
  isPublic: z.boolean().default(true),
  isPrivate: z.boolean().default(false),
});

export const ChangeSchema = z.object({
  severity: z.enum(SEVERITIES).optional(),
  status: z.enum(STATUSES).optional(),
  leadId: userId.optional(),
});

export const UpdateSchema = z.object({
  body: z.string().trim().min(1, 'Write an update first.').max(5000),
  isPublic: z.boolean().default(false),
  status: z.enum(STATUSES).optional(),
});

export const FollowUpSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, 'Describe the follow-up in at least 3 characters.')
    .max(200),
  assigneeId: userId.default(null),
});
