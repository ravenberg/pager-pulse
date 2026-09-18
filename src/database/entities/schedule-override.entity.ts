import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { Schedule } from './schedule.entity.js';
import { User } from './user.entity.js';

/** Someone covering the rotation for a while: a holiday, a swap, a sick day. */
@Entity()
export class ScheduleOverride {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Schedule, (schedule) => schedule.overrides, {
    onDelete: 'CASCADE',
  })
  schedule: Relation<Schedule>;

  /** Who is on call instead. */
  @ManyToOne(() => User, { eager: true, onDelete: 'CASCADE' })
  user: Relation<User>;

  @Column('datetime')
  startsAt: Date;

  @Column('datetime')
  endsAt: Date;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  createdBy: Relation<User> | null;

  @CreateDateColumn()
  createdAt: Date;
}
