// pm2 config for PagerPulse. From this directory:
//
//   pm2 start ecosystem.config.cjs
//
// Settings come from .env next to this file (see .env.example); run
// ops/deploy.sh rather than this by hand, it builds first.
module.exports = {
  apps: [
    {
      name: 'pager-pulse',
      cwd: __dirname,
      script: 'dist/main.js',
      node_args: '--env-file=.env',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
}
