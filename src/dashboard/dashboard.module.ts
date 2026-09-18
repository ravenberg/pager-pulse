import { Module } from '@nestjs/common';
import { OnCallModule } from '../oncall/oncall.module.js';
import { DashboardController } from './dashboard.controller.js';
import { InsightsService } from './insights.service.js';

@Module({
  imports: [OnCallModule],
  controllers: [DashboardController],
  providers: [InsightsService],
})
export class DashboardModule {}
