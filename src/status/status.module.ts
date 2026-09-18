import { Module } from '@nestjs/common';
import { StatusController } from './status.controller.js';
import { SubscriptionsService } from './subscriptions.service.js';

@Module({
  controllers: [StatusController],
  providers: [SubscriptionsService],
  exports: [SubscriptionsService],
})
export class StatusModule {}
