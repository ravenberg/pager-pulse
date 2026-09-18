/** Where the app is reached, for links that leave it: in emails, say. */
export const appUrl = () =>
  (
    process.env.APP_URL ?? `http://localhost:${process.env.PORT ?? 3000}`
  ).replace(/\/+$/, '');
