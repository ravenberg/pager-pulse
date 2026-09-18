import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { Alert } from './alert.entity.js';
import { EscalationPath } from './escalation-path.entity.js';
import { Incident } from './incident.entity.js';
import { User } from './user.entity.js';

/**
 * A page in progress. Which level it is at is not stored: like shifts, it
 * follows from when it started and the path's delays, until someone
 * acknowledges it.
 */
@Entity()
export class Escalation {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => EscalationPath, { eager: true, onDelete: 'CASCADE' })
  path: Relation<EscalationPath>;

  @ManyToOne(() => Incident, { nullable: true, onDelete: 'CASCADE' })
  incident: Relation<Incident> | null;

  @ManyToOne(() => Alert, { nullable: true, onDelete: 'CASCADE' })
  alert: Relation<Alert> | null;

  @Column('varchar')
  reason: string;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  createdBy: Relation<User> | null;

  @CreateDateColumn()
  createdAt: Date;

  @Column('datetime', { nullable: true })
  acknowledgedAt: Date | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  acknowledgedBy: Relation<User> | null;
}
