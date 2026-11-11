import { fileURLToPath, URL } from 'node:url';

import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import vueDevTools from 'vite-plugin-vue-devtools';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    // Teaches Vite to compile .vue single-file components.
    vue(),
    // Adds the Vue DevTools panel (Alt+Shift+D in the page) to inspect
    // components, their props and state.
    vueDevTools(),
  ],
  resolve: {
    alias: {
      // `import x from '@/api'` means src/api.ts, from any folder.
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    // The page runs on http://localhost:5173, the API on :3000. Those are
    // different origins, so the browser would block the requests (CORS).
    // Instead, the page calls /api/... on its own origin, and Vite's dev
    // server forwards it unchanged to Nest (e.g. :3000/api/books).
    // The browser never sees port 3000.
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
      },
    },
  },
});
