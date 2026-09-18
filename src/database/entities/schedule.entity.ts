import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { ScheduleMember } from './schedule-member.entity.js';
import { ScheduleOverride } from './schedule-override.entity.js';

/** A rotation: members take turns, one shift of `shiftHours` each, starting at `startsAt`. */
@Entity()
export class Schedule {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('varchar')
  name: string;

  @Column('datetime')
  startsAt: Date;

  @Column('integer', { default: 168 })
  shiftHours: number;

  @OneToMany(() => ScheduleMember, (member) => member.schedule, {
    cascade: true,
  })
  members: Relation<ScheduleMember[]>;

  @OneToMany(() => ScheduleOverride, (override) => override.schedule)
  overrides: Relation<ScheduleOverride[]>;

  @CreateDateColumn()
  createdAt: Date;
}
