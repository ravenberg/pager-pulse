import {
  Column,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { Team } from './team.entity.js';

/** A component of the product, as shown on the public status page. */
@Entity()
export class Service {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('varchar', { unique: true })
  name: string;

  @Column('varchar', { default: '' })
  description: string;

  @Column('integer', { default: 0 })
  position: number;

  /** Who to go to when it breaks. */
  @ManyToOne(() => Team, { nullable: true, onDelete: 'SET NULL' })
  team: Relation<Team> | null;
}
