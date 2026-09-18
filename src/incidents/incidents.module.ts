import { Module } from '@nestjs/common';
import { AttachmentsController } from '../attachments/attachments.controller.js';
import { StatusModule } from '../status/status.module.js';
import { FollowUpsController } from './follow-ups.controller.js';
import { IncidentsController } from './incidents.controller.js';
import { IncidentsService } from './incidents.service.js';

@Module({
  imports: [StatusModule],
  controllers: [
    IncidentsController,
    FollowUpsController,
    AttachmentsController,
  ],
  providers: [IncidentsService],
  exports: [IncidentsService],
})
export class IncidentsModule {}
