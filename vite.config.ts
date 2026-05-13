import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  define: {
    // jsmediatags usa `!process.browser` para cargar lectores Node/RN; sin esto Vite incluye react-native-fs y rompe el build.
    'process.browser': JSON.stringify(true),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Cloud Media Player',
        short_name: 'CloudMedia',
        description: 'Reproductor de música con OneDrive y Firebase',
        theme_color: '#12151b',
        background_color: '#0a0c0f',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: 'favicon.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any',
          },
        ],
      },
    }),
  ],
})
