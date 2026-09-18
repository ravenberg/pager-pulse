import { Body, Controller, Get, Post, Res } from '@nestjs/common';
import {
  type AnyResponse,
  ValidationException,
  View,
  ViewService,
} from 'nestjs-mvc';
import { z } from 'zod';
import { AuthService } from './auth.service.js';
import { Public } from './public.decorator.js';

const LoginSchema = z.object({
  email: z.string().trim().min(1, 'Enter your email address.'),
  password: z.string().min(1, 'Enter your password.'),
  remember: z.boolean().default(false),
});

@Public()
@Controller()
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly view: ViewService,
  ) {}

  @Get('login')
  @View('Auth/Login')
  loginPage() {
    return {};
  }

  @Post('login')
  async login(
    @Body({ schema: LoginSchema }) body: z.infer<typeof LoginSchema>,
    @Res({ passthrough: true }) res: AnyResponse,
  ) {
    const user = await this.auth.attempt(body.email, body.password);
    if (!user)
      throw new ValidationException({
        email: 'These credentials do not match our records.',
      });

    await this.auth.signIn(res, user, body.remember);
    return this.view
      .flash('success', `Welcome back, ${user.name.split(' ')[0]}.`)
      .intended('/');
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) res: AnyResponse) {
    this.auth.signOut(res);
    return this.view.redirect('/login');
  }
}
