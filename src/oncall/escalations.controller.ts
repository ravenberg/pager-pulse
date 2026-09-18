import { Body, Controller, Param, ParseIntPipe, Post } from '@nestjs/common';
import { ViewService } from 'nestjs-mvc';
import { z } from 'zod';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Responder } from '../auth/roles.decorator.js';
import type { User } from '../database/entities/index.js';
import { EscalationsService } from './escalations.service.js';

const EscalateSchema = z.object({
  pathId: z.coerce.number('Pick an escalation path.').int().positive(),
  reason: z.string().trim().min(3, 'Say why you are paging.').max(200),
  incidentId: z.coerce.number().int().positive().nullable().default(null),
  alertId: z.coerce.number().int().positive().nullable().default(null),
});

@Controller('escalations')
export class EscalationsController {
  constructor(
    private readonly escalations: EscalationsService,
    private readonly view: ViewService,
  ) {}

  /** "Escalate to someone": pages the first level of a path. */
  @Post()
  @Responder()
  async escalate(
    @Body({ schema: EscalateSchema }) body: z.infer<typeof EscalateSchema>,
    @CurrentUser() user: User,
  ) {
    const path = await this.escalations.path(body.pathId);
    await this.escalations.start({ ...body, path, createdBy: user });
    const [first] = await this.escalations.describe(path);
    return this.view
      .flash(
        'success',
        `Paging ${first?.now?.name ?? first?.target ?? 'nobody'} via ${path.name}.`,
      )
      .back();
  }

  /** Anyone logged in can take a page, not only the person it is paging. */
  @Post(':id/acknowledge')
  async acknowledge(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: User,
  ) {
    await this.escalations.acknowledge(id, user);
    return this.view.flash('success', 'Acknowledged. You have it.').back();
  }
}
