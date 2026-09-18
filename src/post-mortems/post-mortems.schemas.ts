import { z } from 'zod';

const section = z.string().trim().max(10_000).default('');

/** Saving a draft takes anything: half a sentence is still worth keeping. */
export const DraftSchema = z.object({
  summary: section,
  impact: section,
  rootCause: section,
  lessons: section,
});

/**
 * What a post-mortem needs before it goes to review. The page validates
 * against this as you type (Precognition): the same Zod schema, run by the
 * same pipe, before the submit button is ever pressed.
 */
export const SubmitSchema = z
  .object({
    summary: z
      .string()
      .trim()
      .min(40, 'Summarise what happened in a few sentences (40+ characters).')
      .max(10_000),
    impact: z
      .string()
      .trim()
      .min(20, 'Say who was affected, and how (20+ characters).')
      .max(10_000),
    rootCause: z
      .string()
      .trim()
      .min(20, 'Explain why it happened (20+ characters).')
      .max(10_000),
    lessons: z
      .string()
      .trim()
      .min(10, 'Write down at least one lesson.')
      .max(10_000),
  })
  .refine(
    (data) =>
      !data.rootCause ||
      data.rootCause.toLowerCase() !== data.summary.toLowerCase(),
    {
      path: ['rootCause'],
      message: 'The root cause should say why, not repeat the summary.',
    },
  );
