import {
  Column,
  CreateDateColumn,
  Entity,
  JoinTable,
  ManyToMany,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  type Relation,
  UpdateDateColumn,
} from 'typeorm';
import { FollowUp } from './follow-up.entity.js';
import { Service } from './service.entity.js';
import { TimelineEntry } from './timeline-entry.entity.js';
import { User } from './user.entity.js';

export const SEVERITIES = ['critical', 'major', 'minor'] as const;
export type Severity = (typeof SEVERITIES)[number];

export const STATUSES = [
  'investigating',
  'identified',
  'monitoring',
  'resolved',
] as const;
export type IncidentStatus = (typeof STATUSES)[number];

@Entity()
export class Incident {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('varchar')
  title: string;

  @Column('text', { default: '' })
  summary: string;

  @Column('varchar')
  severity: Severity;

  @Column('varchar', { default: 'investigating' })
  status: IncidentStatus;

  /** Shown on the public status page. */
  @Column('boolean', { default: true })
  isPublic: boolean;

  /** Only admins, the reporter and the lead can see it. Never public. */
  @Column('boolean', { default: false })
  isPrivate: boolean;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  lead: Relation<User> | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  reporter: Relation<User> | null;

  @ManyToMany(() => Service)
  @JoinTable()
  services: Relation<Service[]>;

  @OneToMany(() => TimelineEntry, (entry) => entry.incident)
  timeline: Relation<TimelineEntry[]>;

  @OneToMany(() => FollowUp, (followUp) => followUp.incident)
  followUps: Relation<FollowUp[]>;

  @CreateDateColumn()
  declaredAt: Date;

  @Column('datetime', { nullable: true })
  resolvedAt: Date | null;

  @UpdateDateColumn()
  updatedAt: Date;
}
