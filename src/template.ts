import type { PageObject, TemplateContext } from 'nestjs-mvc';

export function template(_page: PageObject, ctx: TemplateContext): string {
  return `<!DOCTYPE html>
<html lang="en" data-mantine-color-scheme="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🔥</text></svg>">
<title>PagerPulse</title>
<script${ctx.nonce ? ` nonce="${ctx.nonce}"` : ''}>try{var s=localStorage.getItem('mantine-color-scheme-value');var d=s==='dark'||((!s||s==='auto')&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.setAttribute('data-mantine-color-scheme',d?'dark':'light')}catch(e){}</script>
${ctx.assets()}
${ctx.head()}
</head>
<body>${ctx.body()}</body>
</html>`;
}
