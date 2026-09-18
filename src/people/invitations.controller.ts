import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import {
  type AnyRequest,
  type AnyResponse,
  View,
  ViewService,
  requestUrl,
} from 'nestjs-mvc';
import { z } from 'zod';
import { AuthService } from '../auth/auth.service.js';
import { Public } from '../auth/public.decorator.js';
import { PasswordSchema } from './people.schemas.js';
import { PeopleService } from './people.service.js';

/**
 * Where the link in an invitation lands: no login, the signature is the
 * proof. It is bound to the invitation, which only this controller can look
 * up, so it checks the link itself instead of using @ValidSignature().
 */
@Public()
@Controller('invitations')
export class InvitationsController {
  constructor(
    private readonly people: PeopleService,
    private readonly auth: AuthService,
    private readonly view: ViewService,
  ) {}

  @Get(':id')
  @View('Auth/AcceptInvitation')
  async show(@Param('id', ParseIntPipe) id: number, @Req() req: AnyRequest) {
    const user = await this.people.find(id);
    const verdict = this.people.checkInvitation(req, user);
    return {
      state: verdict,
      name: user.name,
      email: user.email,
      // The form posts back to this same signed URL.
      action: verdict === 'valid' ? requestUrl(req) : null,
    };
  }

  @Post(':id')
  async accept(
    @Param('id', ParseIntPipe) id: number,
    @Body({ schema: PasswordSchema }) body: z.infer<typeof PasswordSchema>,
    @Req() req: AnyRequest,
    @Res({ passthrough: true }) res: AnyResponse,
  ) {
    const user = await this.people.find(id);
    if (this.people.checkInvitation(req, user) !== 'valid')
      return this.view
        .flash('error', 'That invitation no longer works. Ask for a new one.')
        .redirect('/login');
    await this.people.accept(user, body.password);
    await this.auth.signIn(res, user);
    this.view.refresh('people');
    return this.view
      .flash('success', `Welcome to PagerPulse, ${user.name.split(' ')[0]}.`)
      .redirect('/');
  }
}
