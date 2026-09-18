import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { Incident } from './incident.entity.js';
import { User } from './user.entity.js';

export const TIMELINE_KINDS = [
  'declared',
  'update',
  'status',
  'severity',
  'lead',
  'follow_up',
  'post_mortem',
  'call',
] as const;
export type TimelineKind = (typeof TIMELINE_KINDS)[number];

@Entity()
export class TimelineEntry {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Incident, (incident) => incident.timeline, {
    onDelete: 'CASCADE',
  })
  incident: Relation<Incident>;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  author: Relation<User> | null;

  @Column('varchar')
  kind: TimelineKind;

  @Column('text')
  body: string;

  /** Published as an update on the status page. */
  @Column('boolean', { default: false })
  isPublic: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
