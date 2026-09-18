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

/** A file on an incident: a screenshot, a log, a graph. Stored on disk. */
@Entity()
export class Attachment {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Incident, { onDelete: 'CASCADE' })
  incident: Relation<Incident>;

  @Column('varchar')
  filename: string;

  @Column('varchar')
  mimeType: string;

  @Column('integer')
  size: number;

  /** Where it is, relative to the storage directory. */
  @Column('varchar')
  storageKey: string;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  uploadedBy: Relation<User> | null;

  @CreateDateColumn()
  createdAt: Date;
}
