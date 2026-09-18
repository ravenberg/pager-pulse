import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
  Unique,
} from 'typeorm';
import { User } from './user.entity.js';

/** A named filter and set of columns for the incident list, for one person. */
@Entity()
@Unique(['user', 'name'])
export class SavedView {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('varchar')
  name: string;

  @Column('simple-json')
  filters: { state: string; severity: string; search: string };

  @Column('simple-json')
  columns: string[];

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  user: Relation<User>;

  @CreateDateColumn()
  createdAt: Date;
}
