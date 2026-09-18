import {
  randomBytes,
  scrypt,
  timingSafeEqual,
  type ScryptOptions,
} from 'node:crypto';

/**
 * Password hashing with `node:crypto`'s scrypt: no dependency, and the
 * parameters OWASP recommends (N=2^17, r=8, p=1, about 128 MiB per hash, so
 * `maxmem` has to allow it). The parameters are stored with the hash, so they
 * can be raised later without breaking existing passwords.
 */
const PARAMS = { N: 2 ** 17, r: 8, p: 1 };
const KEY_LENGTH = 64;

const derive = (
  password: string,
  salt: Buffer,
  params: typeof PARAMS,
): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    const options: ScryptOptions = { ...params, maxmem: 256 * 1024 * 1024 };
    scrypt(password, salt, KEY_LENGTH, options, (error, key) =>
      error ? reject(error) : resolve(key),
    );
  });

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt, PARAMS);
  return [
    'scrypt',
    PARAMS.N,
    PARAMS.r,
    PARAMS.p,
    salt.toString('base64'),
    key.toString('base64'),
  ].join('$');
}

/** Stands in for a missing user, so an unknown email takes as long to refuse as a wrong password. */
const DUMMY = [
  'scrypt',
  PARAMS.N,
  PARAMS.r,
  PARAMS.p,
  Buffer.alloc(16).toString('base64'),
  Buffer.alloc(KEY_LENGTH).toString('base64'),
].join('$');

/** Compares in constant time, and always does the full amount of work. */
export async function verifyPassword(
  password: string,
  stored: string | null | undefined,
): Promise<boolean> {
  const [scheme, N, r, p, salt, expected] = (stored ?? DUMMY).split('$');
  if (scheme !== 'scrypt' || !salt || !expected) return false;
  const key = await derive(password, Buffer.from(salt, 'base64'), {
    N: Number(N),
    r: Number(r),
    p: Number(p),
  });
  const want = Buffer.from(expected, 'base64');
  return (
    stored !== null &&
    stored !== undefined &&
    want.length === key.length &&
    timingSafeEqual(want, key)
  );
}
