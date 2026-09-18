import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

/** An email PagerPulse would have sent. The demo keeps them for the mailbox page. */
@Entity()
export class OutboxEmail {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('varchar')
  to: string;

  @Column('varchar')
  subject: string;

  @Column('text')
  body: string;

  @Column('simple-json')
  links: { label: string; url: string }[];

  @CreateDateColumn()
  createdAt: Date;
}
