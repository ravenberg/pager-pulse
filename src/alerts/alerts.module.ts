import { Module } from '@nestjs/common';
import { IncidentsModule } from '../incidents/incidents.module.js';
import { AlertIngestController } from './alert-ingest.controller.js';
import { AlertsController } from './alerts.controller.js';
import { AlertsService } from './alerts.service.js';

@Module({
  imports: [IncidentsModule],
  controllers: [AlertIngestController, AlertsController],
  providers: [AlertsService],
  exports: [AlertsService],
})
export class AlertsModule {}
