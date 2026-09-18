import { Injectable, Logger } from '@nestjs/common';
import { type Transporter, createTransport } from 'nodemailer';

export interface Email {
  to: string;
  subject: string;
  text: string;
}

/**
 * Sends email over SMTP when MAIL_URL is set (`smtp://user:pass@host:587`).
 * Without it, as in development, each email is written to the log instead,
 * links and all, the way Laravel's `log` mailer does.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transport: Transporter | null = process.env.MAIL_URL
    ? createTransport(process.env.MAIL_URL)
    : null;
  private readonly from =
    process.env.MAIL_FROM ?? 'PagerPulse <status@pagerpulse.dev>';

  async send(email: Email) {
    if (!this.transport) {
      this.logger.log(
        `To: ${email.to}\nSubject: ${email.subject}\n\n${email.text}`,
      );
      return;
    }
    await this.transport.sendMail({ from: this.from, ...email });
  }
}
