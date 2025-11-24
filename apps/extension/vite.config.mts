import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { babel } from '@rollup/plugin-babel';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const reactNativeShim = path.resolve(__dirname, './src/react-native-web-shim.ts');
const reactNativePackageJson = require.resolve('react-native/package.json');

// Plugin to resolve react-native imports to react-native-web
const reactNativeWebPlugin = (): Plugin => ({
  name: 'react-native-web',
  enforce: 'pre',
  resolveId(source) {
    if (source.startsWith('react-native/Libraries/Renderer/shims/')) {
      return `virtual:${source}`;
    }

    if (
      source === 'react-native/Libraries/Components/View/View' ||
      source === 'react-native/Libraries/Components/View/View.js'
    ) {
      return 'virtual:react-native-view';
    }

    if (source === 'react-native') {
      return reactNativeShim;
    }

    if (source === 'react-native/package.json') {
      return reactNativePackageJson;
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
  load(id) {
    if (id.startsWith('virtual:react-native/Libraries/Renderer/shims/')) {
      if (id.includes('ReactNativeViewConfigRegistry')) {
        return 'export const customDirectEventTypes = {}; export default { customDirectEventTypes };';
      }

      return 'export default {}';
    }

    if (id === 'virtual:react-native-view') {
      return "export { default } from 'react-native-web/dist/exports/View/index.js'; export * from 'react-native-web/dist/exports/View/index.js';";
    }

    if (id.includes('react-native/Libraries/Components/View/View.js')) {
      return "export { default } from 'react-native-web/dist/exports/View/index.js'; export * from 'react-native-web/dist/exports/View/index.js';";
    }
  },
});

const flowStripPlugin = babel({
  babelHelpers: 'bundled',
  extensions: ['.js', '.jsx', '.ts', '.tsx'],
  plugins: ['@babel/plugin-transform-flow-strip-types', '@babel/plugin-transform-react-jsx'],
  include: ['**/node_modules/react-native/**'],
});

export default defineConfig({
  plugins: [reactNativeWebPlugin(), flowStripPlugin, react()],
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  resolve: {
    alias: [
      { find: '@', replacement: path.resolve(__dirname, './src') },
      { find: 'react-native/package.json', replacement: reactNativePackageJson },
      { find: /^react-native$/, replacement: reactNativeShim },
      { find: 'react-native-reanimated', replacement: 'react-native-reanimated/mock' },
    ],
  },
});
