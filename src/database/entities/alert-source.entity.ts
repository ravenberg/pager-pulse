import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { Service } from './service.entity.js';

/** Somewhere alerts come from: a monitoring tool posting to the ingest endpoint. */
@Entity()
export class AlertSource {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('varchar')
  name: string;

  /** The bearer token the tool sends. */
  @Column('varchar', { unique: true })
  token: string;

  /** Incidents declared from this source's alerts affect this service. */
  @ManyToOne(() => Service, { nullable: true, onDelete: 'SET NULL' })
  service: Relation<Service> | null;

  @CreateDateColumn()
  createdAt: Date;
}
