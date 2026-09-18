import { Module } from '@nestjs/common';
import { FollowUpsController } from './follow-ups.controller.js';
import { IncidentsController } from './incidents.controller.js';
import { IncidentsService } from './incidents.service.js';

@Module({
  controllers: [IncidentsController, FollowUpsController],
  providers: [IncidentsService],
  exports: [IncidentsService],
})
export class IncidentsModule {}
