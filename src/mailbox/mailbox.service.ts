import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OutboxEmail } from '../database/entities/index.js';

export interface Email {
  to: string;
  subject: string;
  body: string;
  links?: { label: string; url: string }[];
}

/**
 * Where email goes. The demo sends none: it keeps each one for the mailbox
 * page, where the links in it can be clicked. A real app would put an SMTP
 * or API transport behind the same `send()`.
 */
@Injectable()
export class MailboxService {
  constructor(
    @InjectRepository(OutboxEmail)
    private readonly outbox: Repository<OutboxEmail>,
  ) {}

  async send(email: Email) {
    await this.outbox.save(
      this.outbox.create({ ...email, links: email.links ?? [] }),
    );
  }

  latest(take = 50) {
    return this.outbox.find({ order: { createdAt: 'DESC', id: 'DESC' }, take });
  }
}
