import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { type AnyResponse, clearCookie, writeCookie } from 'nestjs-mvc';
import { IsNull, Repository } from 'typeorm';
import { User } from '../database/entities/index.js';
import { verifyPassword } from './passwords.js';

/** The HttpOnly cookie that carries the token: page scripts cannot read it. */
export const ACCESS_TOKEN_COOKIE = 'access_token';

const THIRTY_DAYS = 30 * 24 * 60 * 60;

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly jwt: JwtService,
  ) {}

  /** The user with this email and password, or `null`; the same time either way. */
  async attempt(email: string, password: string): Promise<User | null> {
    const user = await this.users.findOne({
      where: { email: email.trim().toLowerCase() },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        passwordHash: true,
        deactivatedAt: true,
      },
    });
    const valid = await verifyPassword(password, user?.passwordHash);
    return valid && user && !user.deactivatedAt ? user : null;
  }

  /** The user a token belongs to, or `null` when it is missing, forged, expired, or the user is gone. */
  async userFromToken(token: string): Promise<User | null> {
    try {
      const { sub } = await this.jwt.verifyAsync<{ sub: number }>(token);
      // Checked on every request, so deactivating someone logs them out.
      return await this.users.findOneBy({ id: sub, deactivatedAt: IsNull() });
    } catch {
      return null;
    }
  }

  async signIn(res: AnyResponse, user: User, remember = false): Promise<void> {
    const token = await this.jwt.signAsync(
      { sub: user.id },
      { expiresIn: remember ? '30d' : '12h' },
    );
    writeCookie(res, ACCESS_TOKEN_COOKIE, token, {
      maxAge: remember ? THIRTY_DAYS : undefined,
      httpOnly: true,
      sameSite: 'Lax',
      secure: process.env.NODE_ENV === 'production',
    });
  }

  signOut(res: AnyResponse): void {
    clearCookie(res, ACCESS_TOKEN_COOKIE, {
      secure: process.env.NODE_ENV === 'production',
    });
  }
}
