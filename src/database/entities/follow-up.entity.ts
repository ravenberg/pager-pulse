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

@Entity()
export class FollowUp {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Incident, (incident) => incident.followUps, {
    onDelete: 'CASCADE',
  })
  incident: Relation<Incident>;

  @Column('varchar')
  title: string;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  assignee: Relation<User> | null;

  @Column('datetime', { nullable: true })
  completedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
