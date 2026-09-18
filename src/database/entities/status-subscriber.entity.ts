import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

/** Someone who gets an email for every public update on the status page. */
@Entity()
export class StatusSubscriber {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('varchar', { unique: true })
  email: string;

  /** Null until they click the link in the confirmation email. */
  @Column('datetime', { nullable: true })
  confirmedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
