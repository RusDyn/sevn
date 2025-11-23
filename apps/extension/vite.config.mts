import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    commonjsOptions: {
      transformMixedEsModules: true,
      ignore: ['react-native'],
    },
    rollupOptions: {
      external: (id) => id === 'react-native' || id.startsWith('react-native-') || id.startsWith('expo-'),
    },
  },
  optimizeDeps: {
    exclude: ['react-native'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'react-native$': 'react-native-web',
    },
  },
});
