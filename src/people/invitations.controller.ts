import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  Res,
  ForbiddenException,
} from '@nestjs/common';
import {
  type AnyRequest,
  type AnyResponse,
  ValidSignature,
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
 * Where an invitation link lands: no login, the signature is the proof.
 * @ValidSignature() turns away a link that was changed or has expired (a 403,
 * shown as the error page); the handler then makes sure it's the invitation
 * that's still open, so a link works once.
 */
@Public()
@ValidSignature()
@Controller('invitations')
export class InvitationsController {
  constructor(
    private readonly people: PeopleService,
    private readonly auth: AuthService,
    private readonly view: ViewService,
  ) {}

  @Get(':id')
  @View('Auth/AcceptInvitation')
  async show(
    @Param('id', ParseIntPipe) id: number,
    @Query('v') v: string | undefined,
    @Req() req: AnyRequest,
  ) {
    const user = await this.openInvitation(id, v);
    return {
      name: user.name,
      email: user.email,
      // The form posts back to this same signed URL.
      action: requestUrl(req),
    };
  }

  @Post(':id')
  async accept(
    @Param('id', ParseIntPipe) id: number,
    @Query('v') v: string | undefined,
    @Body({ schema: PasswordSchema }) body: z.infer<typeof PasswordSchema>,
    @Res({ passthrough: true }) res: AnyResponse,
  ) {
    const user = await this.openInvitation(id, v);
    await this.people.accept(user, body.password);
    await this.auth.signIn(res, user);
    this.view.refresh('people');
    return this.view
      .flash('success', `Welcome to PagerPulse, ${user.name.split(' ')[0]}.`)
      .redirect('/');
  }

  private async openInvitation(id: number, v: string | undefined) {
    const user = await this.people.find(id);
    if (!this.people.isOpenInvitation(user, v))
      throw new ForbiddenException(
        'This invitation has been used, or a newer link was made. Ask for a new one.',
      );
    return user;
  }
}
