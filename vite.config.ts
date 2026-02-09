import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => {
  // 加载环境变量
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@langchain/mcp-adapters': path.resolve(__dirname, 'node_modules/@langchain/mcp-adapters'),
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
    // 定义环境变量
    define: {
      'process.env': env
    },
    // 开发服务器配置
    server: {
      port: 3000,
      open: true,
      proxy: {
        // 代理API请求
        '/dev-api': {
          target: mode === 'production' 
            ? 'https://api.example.com' 
            : 'http://localhost:6039',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, '')
        }
        ,
        // 代理静态预览资源，保证与前端同源，避免 iframe 跨域
        '/static': {
          target: mode === 'production'
            ? 'https://www.mcp-x.com/prod-api'
            : 'http://localhost:6039',
          changeOrigin: true,
          // 直接透传 /static 前缀
        }
      }
    },
    // 构建选项
    build: {
      outDir: 'dist',
      sourcemap: mode !== 'production'
    }
  };
});
