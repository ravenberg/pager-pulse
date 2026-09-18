import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

export const ROLES = ['admin', 'responder', 'viewer'] as const;
export type Role = (typeof ROLES)[number];

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('varchar')
  name: string;

  @Column('varchar', { unique: true })
  email: string;

  /** Left out of every query unless selected explicitly. */
  @Column('varchar', { select: false, nullable: true })
  passwordHash: string | null;

  @Column('varchar', { default: 'responder' })
  role: Role;

  /** Set while an invitation is open: the person has no password yet. */
  @Column('datetime', { nullable: true })
  invitedAt: Date | null;

  /** A deactivated person can't log in, and their sessions end. */
  @Column('datetime', { nullable: true })
  deactivatedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
