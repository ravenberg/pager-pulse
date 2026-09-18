import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { View, ViewService, optional } from 'nestjs-mvc';
import { Repository } from 'typeorm';
import { z } from 'zod';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Responder } from '../auth/roles.decorator.js';
import { type Incident, PostMortem, User } from '../database/entities/index.js';
import { IncidentsService } from '../incidents/incidents.service.js';
import {
  followUp,
  incidentRow,
  person,
  reference,
  timelineEntry,
} from '../incidents/serializers.js';
import { DraftSchema, SubmitSchema } from './post-mortems.schemas.js';

type Draft = z.infer<typeof DraftSchema>;

/**
 * The post-incident flow, as incident.io runs it: once an incident is
 * resolved, its team documents it (draft), has it reviewed (in review) and
 * publishes it (closed).
 */
@Controller('incidents/:id/post-mortem')
export class PostMortemsController {
  constructor(
    private readonly incidents: IncidentsService,
    private readonly view: ViewService,
    @InjectRepository(PostMortem)
    private readonly postMortems: Repository<PostMortem>,
  ) {}

  @Get()
  @View('PostMortems/Edit')
  async edit(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    const incident = await this.incidents.find(id, user);
    if (incident.isPrivate) this.view.encryptHistory();
    const postMortem = await this.of(incident);

    return {
      incident: incidentRow(incident),
      postMortem: postMortem && {
        status: postMortem.status,
        summary: postMortem.summary,
        impact: postMortem.impact,
        rootCause: postMortem.rootCause,
        lessons: postMortem.lessons,
        author: person(postMortem.author),
        updatedAt: postMortem.updatedAt.toISOString(),
        publishedAt: postMortem.publishedAt?.toISOString() ?? null,
      },
      followUps: async () =>
        (await this.incidents.followUpsOf(incident)).map(followUp),
      // Reference material while writing: only fetched if the writer opens it.
      timeline: optional(async () =>
        (await this.incidents.timelineOf(incident)).map(timelineEntry),
      ),
      canEdit:
        user.role !== 'viewer' &&
        incident.status === 'resolved' &&
        postMortem?.status !== 'published',
      canPublish:
        postMortem?.status === 'in_review' && this.canPublish(incident, user),
    };
  }

  @Put()
  @Responder()
  async save(
    @Param('id', ParseIntPipe) id: number,
    @Body({ schema: DraftSchema }) body: Draft,
    @CurrentUser() user: User,
  ) {
    await this.write(await this.editable(id, user), body, user);
    return this.view.flash('success', 'Draft saved.').back();
  }

  @Post('submit')
  @Responder()
  async submit(
    @Param('id', ParseIntPipe) id: number,
    @Body({ schema: SubmitSchema }) body: Draft,
    @CurrentUser() user: User,
  ) {
    const incident = await this.editable(id, user);
    await this.write(incident, body, user, 'in_review');
    await this.incidents.notePostMortem(
      incident,
      user,
      'Post-mortem submitted for review.',
    );
    return this.view
      .flash(
        'success',
        'Submitted. The incident lead or an admin publishes it.',
      )
      .back();
  }

  @Post('publish')
  async publish(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: User,
  ) {
    const incident = await this.incidents.find(id, user);
    const postMortem = await this.of(incident);
    if (postMortem?.status !== 'in_review')
      throw new ForbiddenException(
        'Only a post-mortem in review is published.',
      );
    if (!this.canPublish(incident, user))
      throw new ForbiddenException(
        'The incident lead or an admin publishes the post-mortem.',
      );
    await this.postMortems.update(postMortem.id, {
      status: 'published',
      publishedAt: new Date(),
    });
    await this.incidents.notePostMortem(
      incident,
      user,
      'Post-mortem published. The incident is closed.',
    );
    return this.view
      .flash('success', `${reference(incident)} is closed.`)
      .redirect(`/incidents/${incident.id}`);
  }

  private of(incident: Incident) {
    return this.postMortems.findOne({
      where: { incident: { id: incident.id } },
      relations: { author: true },
    });
  }

  private canPublish(incident: Incident, user: User) {
    return user.role === 'admin' || incident.lead?.id === user.id;
  }

  /** Post-incident starts when the incident is resolved, and ends when published. */
  private async editable(id: number, user: User) {
    const incident = await this.incidents.find(id, user);
    if (incident.status !== 'resolved')
      throw new ForbiddenException(
        'Write the post-mortem once the incident is resolved.',
      );
    if ((await this.of(incident))?.status === 'published')
      throw new ForbiddenException('This post-mortem is already published.');
    return incident;
  }

  private async write(
    incident: Incident,
    body: Draft,
    author: User,
    status?: PostMortem['status'],
  ) {
    const existing = await this.of(incident);
    await this.postMortems.save({
      ...(existing ?? { incident, author }),
      ...body,
      ...(status ? { status } : {}),
    });
  }
}
