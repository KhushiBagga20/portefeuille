// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  devToolbar: { enabled: false },
  server: { port: 4321 },
  // The record room used to live at /music; it's now a room of the Playground.
  redirects: {
    '/music': '/playground/music/',
  },
});
