import { Controller, Get } from '@nestjs/common';
import { View } from 'nestjs-mvc';
import { Roles } from '../auth/roles.decorator.js';
import { MailboxService } from './mailbox.service.js';

@Controller('mailbox')
export class MailboxController {
  constructor(private readonly mailbox: MailboxService) {}

  /** The emails PagerPulse would have sent, newest first. */
  @Get()
  @Roles('admin')
  @View('Mailbox/Index')
  async index() {
    return {
      emails: (await this.mailbox.latest()).map((email) => ({
        id: email.id,
        to: email.to,
        subject: email.subject,
        body: email.body,
        links: email.links,
        createdAt: email.createdAt.toISOString(),
      })),
    };
  }
}
