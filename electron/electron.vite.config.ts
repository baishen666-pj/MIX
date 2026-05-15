import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        external: ['better-sqlite3']
      }
    }
  },
  preload: {
    build: {
      rollupOptions: {
        external: ['electron']
      }
    }
  },
  renderer: {
    root: resolve('src/renderer'),
    build: {
      outDir: resolve(__dirname, 'out/renderer'),
      rollupOptions: {
        input: resolve('src/renderer/index.html'),
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('@xyflow') || id.includes('@reactflow')) {
                return 'vendor-xyflow'
              }
              if (
                id.includes('react-markdown') ||
                id.includes('remark-gfm') ||
                id.includes('remark') ||
                id.includes('unified') ||
                id.includes('micromark') ||
                id.includes('mdast') ||
                id.includes('unist')
              ) {
                return 'vendor-markdown'
              }
              if (
                id.includes('react-syntax-highlighter') ||
                id.includes('prismjs') ||
                id.includes('refractor')
              ) {
                return 'vendor-syntax'
              }
              if (
                id.includes('/react/') ||
                id.includes('/react-dom/') ||
                id.includes('/scheduler/')
              ) {
                return 'vendor-react'
              }
            }
          }
        }
      }
    },
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@shared': resolve('src/shared')
      }
    },
    define: {
      'import.meta.env.VITE_API_URL': JSON.stringify('http://127.0.0.1:18789'),
      'import.meta.env.VITE_WS_URL': JSON.stringify('ws://127.0.0.1:18789/ws/chat')
    },
    plugins: [tailwindcss(), react()],
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:18789',
          changeOrigin: true
        },
        '/ws': {
          target: 'http://127.0.0.1:18789',
          ws: true
        }
      }
    }
  }
})
