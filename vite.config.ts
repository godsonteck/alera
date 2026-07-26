import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

const manualChunks = (id: string) => {
  if (!id.includes('node_modules')) return undefined;
  if (id.includes('react-router-dom')) return 'router';
  if (id.includes('recharts')) return 'charts';
  if (id.includes('framer-motion')) return 'motion';
  if (id.includes('@radix-ui') || id.includes('cmdk') || id.includes('vaul') || id.includes('sonner')) return 'ui';
  if (id.includes('react')) return 'react-vendor';
  return undefined;
};

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const isDev = mode === 'development';
  const sourcemap = env.VITE_SOURCEMAP
    ? ['1', 'true', 'yes', 'on'].includes(env.VITE_SOURCEMAP.toLowerCase())
    : isDev;
  const dropConsole = env.VITE_DROP_CONSOLE
    ? ['1', 'true', 'yes', 'on'].includes(env.VITE_DROP_CONSOLE.toLowerCase())
    : !isDev;
  
  return {
    server: {
      host: '::',
      port: 8080,
      hmr: {
        overlay: true,
      },
    },
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
      dedupe: ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime'],
    },
    build: {
      outDir: 'dist',
      target: 'es2020',
      sourcemap,
      minify: isDev ? false : 'esbuild',
      cssCodeSplit: true,
      reportCompressedSize: false,
      esbuild: isDev ? undefined : {
        drop: ['console', 'debugger'],
        dropLabels: dropConsole ? ['DEV_ONLY'] : [],
      },
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        output: {
          manualChunks,
          entryFileNames: 'js/[name]-[hash].js',
          chunkFileNames: 'js/[name]-[hash].js',
          assetFileNames: ({ name }) => {
            if (name && name.endsWith('.css')) {
              return 'css/[name]-[hash][extname]';
            }
            return 'assets/[name]-[hash][extname]';
          },
        },
      },
    },
    define: {
      __DEV__: JSON.stringify(isDev),
    },
  };
});
