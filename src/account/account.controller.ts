import { Body, Controller, Get, Put } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ValidationException, View, ViewService } from 'nestjs-mvc';
import { Not, Repository } from 'typeorm';
import { z } from 'zod';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { hashPassword, verifyPassword } from '../auth/passwords.js';
import { User } from '../database/entities/index.js';
import { PasswordSchema } from '../people/people.schemas.js';

const ProfileSchema = z.object({
  name: z.string().trim().min(2, 'Enter your name.').max(80),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(120)
    .pipe(z.email('Enter a valid email address.')),
});

const ChangePasswordSchema = PasswordSchema.and(
  z.object({ current: z.string().min(1, 'Enter your current password.') }),
);

/**
 * Your own account. Two forms on one page, each posting with its own error
 * bag (`profile`, `password`), so a mistake in one never shows up under the
 * other.
 */
@Controller('account')
export class AccountController {
  constructor(
    private readonly view: ViewService,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  @Get()
  @View('Account/Edit')
  show(@CurrentUser() user: User) {
    return {
      role: user.role,
      memberSince: user.createdAt.toISOString(),
    };
  }

  @Put()
  async updateProfile(
    @Body({ schema: ProfileSchema }) body: z.infer<typeof ProfileSchema>,
    @CurrentUser() user: User,
  ) {
    if (await this.users.existsBy({ email: body.email, id: Not(user.id) }))
      throw new ValidationException({
        email: 'Someone else already uses that address.',
      });
    await this.users.update(user.id, body);
    // Other pages keep the list of people; your name may be in it.
    this.view.refresh('people');
    return this.view.flash('success', 'Profile saved.').back();
  }

  /** Precognitive on the client: the rules are checked while you type. */
  @Put('password')
  async updatePassword(
    @Body({ schema: ChangePasswordSchema })
    body: z.infer<typeof ChangePasswordSchema>,
    @CurrentUser() user: User,
  ) {
    const stored = await this.users.findOne({
      where: { id: user.id },
      select: { id: true, passwordHash: true },
    });
    if (!(await verifyPassword(body.current, stored?.passwordHash)))
      throw new ValidationException({
        current: 'That is not your current password.',
      });
    await this.users.update(user.id, {
      passwordHash: await hashPassword(body.password),
    });
    return this.view.flash('success', 'Password changed.').back();
  }
}
