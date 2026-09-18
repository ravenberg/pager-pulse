import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** One step of a path: who gets paged, and how long they have to respond. */
export interface EscalationLevel {
  /** Page whoever is on call on this schedule… */
  scheduleId: number | null;
  /** …or this person. */
  userId: number | null;
  /** Minutes before the next level is paged, if nobody acknowledged. */
  delayMinutes: number;
}

/** Who to page, and in what order, when something needs a human. */
@Entity()
export class EscalationPath {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('varchar')
  name: string;

  @Column('simple-json')
  levels: EscalationLevel[];
}
