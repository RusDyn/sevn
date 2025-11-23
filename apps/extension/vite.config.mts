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
    // Allow react-native dependencies needed by the popup (e.g. gesture-handler, reanimated)
    // to be bundled/aliased instead of being marked external.
    if (
      (source.startsWith('react-native-') || source.startsWith('expo-')) &&
      !['react-native-gesture-handler', 'react-native-reanimated'].includes(source)
    ) {
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
