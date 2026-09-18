import { Module } from '@nestjs/common';
import { AttachmentsController } from '../attachments/attachments.controller.js';
import { StatusModule } from '../status/status.module.js';
import { FollowUpsController } from './follow-ups.controller.js';
import { IncidentsController } from './incidents.controller.js';
import { IncidentsService } from './incidents.service.js';
import { SavedViewsController } from './saved-views.controller.js';

@Module({
  imports: [StatusModule],
  controllers: [
    SavedViewsController,
    IncidentsController,
    FollowUpsController,
    AttachmentsController,
  ],
  providers: [IncidentsService],
  exports: [IncidentsService],
})
export class IncidentsModule {}
