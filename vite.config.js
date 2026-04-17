import { defineConfig } from 'vite';

export default defineConfig({
    base: '/worms/',
    server: {
        host: true,
        port: 5173,
        open: true,
        strictPort: true
    }
});
