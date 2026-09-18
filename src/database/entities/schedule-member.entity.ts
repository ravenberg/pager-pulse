import {
  Column,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { Schedule } from './schedule.entity.js';
import { User } from './user.entity.js';

@Entity()
export class ScheduleMember {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Schedule, (schedule) => schedule.members, {
    onDelete: 'CASCADE',
  })
  schedule: Relation<Schedule>;

  @ManyToOne(() => User, { eager: true, onDelete: 'CASCADE' })
  user: Relation<User>;

  @Column('integer')
  position: number;
}
