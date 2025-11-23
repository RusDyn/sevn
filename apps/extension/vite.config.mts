import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// Plugin to resolve react-native imports to react-native-web
const reactNativeWebPlugin = (): Plugin => ({
  name: 'react-native-web',
  enforce: 'pre',
  resolveId(source) {
    if (source === 'react-native') {
      return this.resolve('react-native-web', undefined, { skipSelf: true });
    }
    // External react-native-* and expo-* packages that aren't needed for web
    if (source.startsWith('react-native-') || source.startsWith('expo-')) {
      return { id: source, external: true };
    }
  },
});

export default defineConfig({
  plugins: [reactNativeWebPlugin(), react()],
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
