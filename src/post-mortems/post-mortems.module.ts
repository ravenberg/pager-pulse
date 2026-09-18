import { Module } from '@nestjs/common';
import { IncidentsModule } from '../incidents/incidents.module.js';
import { PostMortemsController } from './post-mortems.controller.js';

@Module({
  imports: [IncidentsModule],
  controllers: [PostMortemsController],
})
export class PostMortemsModule {}
