import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // For GitHub project pages (you.github.io/flood-icons) set BASE_PATH=/flood-icons/
  // in the deploy workflow. Root domains / custom domains need no change.
  base: process.env.BASE_PATH || '/',
  plugins: [react()],
});
