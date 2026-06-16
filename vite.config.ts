import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, './src'),
          '@api': path.resolve(__dirname, './src/api'),
          '@components': path.resolve(__dirname, './src/components'),
          '@pages': path.resolve(__dirname, './src/pages'),
          '@contexts': path.resolve(__dirname, './src/contexts'),
          '@hooks': path.resolve(__dirname, './src/hooks'),
          '@types': path.resolve(__dirname, './src/types'),
          '@lib': path.resolve(__dirname, './src/lib'),
        }
      }
    };
});
