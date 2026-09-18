import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

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
}
