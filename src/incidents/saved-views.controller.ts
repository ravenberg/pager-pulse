import {
  Body,
  Controller,
  Delete,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ValidationException, ViewService } from 'nestjs-mvc';
import { Repository } from 'typeorm';
import { z } from 'zod';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { SavedView, SEVERITIES, User } from '../database/entities/index.js';

export const COLUMNS = ['severity', 'status', 'lead', 'services', 'duration'];

const SavedViewSchema = z.object({
  name: z.string().trim().min(1, 'Name the view.').max(40),
  filters: z.object({
    state: z.enum(['open', 'resolved', 'all']).default('open'),
    severity: z.enum(['', ...SEVERITIES]).default(''),
    search: z.string().trim().max(100).default(''),
  }),
  columns: z.array(z.enum(COLUMNS)).default(COLUMNS),
});

export const savedView = (view: SavedView) => ({
  id: view.id,
  name: view.name,
  filters: view.filters,
  columns: view.columns,
});

/** Everyone's own named filters for the incident list. */
@Controller('incidents/views')
export class SavedViewsController {
  constructor(
    private readonly view: ViewService,
    @InjectRepository(SavedView)
    private readonly views: Repository<SavedView>,
  ) {}

  @Post()
  async create(
    @Body({ schema: SavedViewSchema }) body: z.infer<typeof SavedViewSchema>,
    @CurrentUser() user: User,
  ) {
    if (await this.views.existsBy({ user: { id: user.id }, name: body.name }))
      throw new ValidationException({
        name: 'You already have a view with that name.',
      });
    await this.views.save(this.views.create({ ...body, user }));
    return this.view.flash('success', `View “${body.name}” saved.`).back();
  }

  @Delete(':id')
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: User,
  ) {
    const saved = await this.views.findOneBy({ id, user: { id: user.id } });
    if (!saved) throw new NotFoundException('There is no such view.');
    await this.views.remove(saved);
    return this.view.flash('success', `View “${saved.name}” removed.`).back();
  }
}
