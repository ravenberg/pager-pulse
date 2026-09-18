import { z } from 'zod';
import { ROLES } from '../database/entities/index.js';

/** A new password, typed twice. */
export const PasswordSchema = z
  .object({
    password: z
      .string()
      .min(10, 'Use at least 10 characters.')
      .max(200)
      .refine(
        (value) => !/^(.)\1*$/.test(value),
        'Not one character over and over.',
      ),
    confirmation: z.string(),
  })
  .refine((data) => data.password === data.confirmation, {
    message: 'The passwords are not the same.',
    path: ['confirmation'],
  });

export const InviteSchema = z.object({
  name: z.string().trim().min(2, 'Enter their name.').max(80),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(120)
    .pipe(z.email('Enter a valid email address.')),
  role: z.enum(ROLES, 'Pick a role.'),
});

export const RoleSchema = z.object({ role: z.enum(ROLES, 'Pick a role.') });
