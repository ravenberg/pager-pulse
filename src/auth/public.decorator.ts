import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Opens a route to guests. Every other route needs a logged-in user. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
