import { Module } from '@nestjs/common';
import { EscalationsController } from './escalations.controller.js';
import { EscalationsService } from './escalations.service.js';
import { OnCallController } from './oncall.controller.js';
import { OnCallService } from './oncall.service.js';

@Module({
  controllers: [OnCallController, EscalationsController],
  providers: [OnCallService, EscalationsService],
  exports: [OnCallService, EscalationsService],
})
export class OnCallModule {}
