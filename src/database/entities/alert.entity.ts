import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
  UpdateDateColumn,
} from 'typeorm';
import { AlertSource } from './alert-source.entity.js';
import { Incident, type Severity } from './incident.entity.js';
import { User } from './user.entity.js';

export const ALERT_STATUSES = ['firing', 'acknowledged', 'resolved'] as const;
export type AlertStatus = (typeof ALERT_STATUSES)[number];

/**
 * A signal from a monitoring tool. The same `dedupKey` firing again while the
 * alert is open counts as another occurrence instead of a new alert.
 */
@Entity()
@Index(['source', 'dedupKey'])
export class Alert {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => AlertSource, { onDelete: 'CASCADE' })
  source: Relation<AlertSource>;

  @Column('varchar')
  title: string;

  @Column('text', { default: '' })
  description: string;

  @Column('varchar')
  severity: Severity;

  @Column('varchar', { default: 'firing' })
  status: AlertStatus;

  @Column('varchar', { nullable: true })
  dedupKey: string | null;

  @Column('simple-json', { default: '{}' })
  labels: Record<string, string>;

  @Column('integer', { default: 1 })
  occurrences: number;

  /** The incident declared from this alert, or that it was attached to. */
  @ManyToOne(() => Incident, { nullable: true, onDelete: 'SET NULL' })
  incident: Relation<Incident> | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  acknowledgedBy: Relation<User> | null;

  @CreateDateColumn()
  firstSeenAt: Date;

  @Column('datetime')
  lastSeenAt: Date;

  @Column('datetime', { nullable: true })
  resolvedAt: Date | null;

  /** What the inbox polls on: anything that changed since its last look. */
  @UpdateDateColumn()
  updatedAt: Date;
}
