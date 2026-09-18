import { Module } from '@nestjs/common';
import { OnCallModule } from '../oncall/oncall.module.js';
import { DashboardController } from './dashboard.controller.js';
import { InsightsService } from './insights.service.js';
import { UpstreamService } from './upstream.service.js';

@Module({
  imports: [OnCallModule],
  controllers: [DashboardController],
  providers: [InsightsService, UpstreamService],
})
export class DashboardModule {}
