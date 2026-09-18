import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
  type Relation,
  UpdateDateColumn,
} from 'typeorm';
import { Incident } from './incident.entity.js';
import { User } from './user.entity.js';

export const POST_MORTEM_STATUSES = [
  'draft',
  'in_review',
  'published',
] as const;
export type PostMortemStatus = (typeof POST_MORTEM_STATUSES)[number];

/** What the team learned, written once the incident is resolved. */
@Entity()
export class PostMortem {
  @PrimaryGeneratedColumn()
  id: number;

  @OneToOne(() => Incident, { onDelete: 'CASCADE' })
  @JoinColumn()
  incident: Relation<Incident>;

  @Column('varchar', { default: 'draft' })
  status: PostMortemStatus;

  @Column('text', { default: '' })
  summary: string;

  @Column('text', { default: '' })
  impact: string;

  @Column('text', { default: '' })
  rootCause: string;

  @Column('text', { default: '' })
  lessons: string;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  author: Relation<User> | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column('datetime', { nullable: true })
  publishedAt: Date | null;
}
