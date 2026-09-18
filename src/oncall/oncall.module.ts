import { Module } from '@nestjs/common';
import { OnCallController } from './oncall.controller.js';
import { OnCallService } from './oncall.service.js';

@Module({
  controllers: [OnCallController],
  providers: [OnCallService],
  exports: [OnCallService],
})
export class OnCallModule {}
