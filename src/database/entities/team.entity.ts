import {
  Column,
  CreateDateColumn,
  Entity,
  JoinTable,
  ManyToMany,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { User } from './user.entity.js';

/** People who own services together. */
@Entity()
export class Team {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('varchar', { unique: true })
  name: string;

  @ManyToMany(() => User)
  @JoinTable()
  members: Relation<User[]>;

  @CreateDateColumn()
  createdAt: Date;
}
