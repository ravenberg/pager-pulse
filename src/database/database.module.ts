import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DatabaseSeeder } from './database.seeder.js';
import {
  Alert,
  AlertSource,
  Attachment,
  Escalation,
  EscalationPath,
  FollowUp,
  Incident,
  PostMortem,
  Schedule,
  ScheduleMember,
  ScheduleOverride,
  Service,
  StatusSubscriber,
  Team,
  TimelineEntry,
  User,
} from './entities/index.js';

const entities = [
  User,
  AlertSource,
  Alert,
  Service,
  Incident,
  PostMortem,
  TimelineEntry,
  FollowUp,
  Schedule,
  ScheduleMember,
  ScheduleOverride,
  EscalationPath,
  Escalation,
  StatusSubscriber,
  Attachment,
  Team,
];

@Global()
@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'better-sqlite3',
      database: process.env.DATABASE_PATH ?? 'pager-pulse.sqlite',
      entities,
      // Demo app: TypeORM owns the schema instead of migrations.
      synchronize: true,
    }),
    TypeOrmModule.forFeature(entities),
  ],
  providers: [DatabaseSeeder],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
