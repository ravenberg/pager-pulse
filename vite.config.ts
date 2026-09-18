import react from '@vitejs/plugin-react';
import { nestjsMvc } from 'nestjs-mvc/vite';
import { defineConfig } from 'vite';

// No entry file: nestjsMvc() generates the client and SSR entries from
// frontend/pages and links frontend/app.css.
export default defineConfig({
  plugins: [react(), nestjsMvc()],
});
