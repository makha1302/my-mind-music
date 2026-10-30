import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // 'prompt' = มีเวอร์ชันใหม่แล้วถามก่อน (UpdateBanner) ไม่รีโหลดเอง
      // ถ้าใช้ 'autoUpdate' หน้าจะรีโหลดเองทันที ถ้ากำลังอัดอยู่ การอัดจะโดนตัด
      registerType: 'prompt',
      // service worker ไม่ทำงานใน npm run dev (แก้โค้ดแล้วจะได้เห็นทันที) เทสด้วย build + preview
      devOptions: { enabled: false },
      includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png', 'icon.svg'],
      manifest: {
        name: 'My Mind Music',
        short_name: 'Mind Music',
        description: 'ห้องไอเดียสำหรับอัดทำนองที่นึกออก',
        lang: 'th',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        // สีพื้นแอป (neutral-950) จอโหลดตอนเปิดแอปจะได้ไม่แวบขาว
        background_color: '#0a0a0a',
        theme_color: '#0a0a0a',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // เก็บตัวแอปทั้งหมดไว้ในเครื่อง เปิดตอนออฟไลน์ได้
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        cleanupOutdatedCaches: true,
        // ไม่มี runtimeCaching ของ Supabase: ข้อมูลอยู่ใน IndexedDB อยู่แล้ว แคชซ้ำจะได้ของเก่า
      },
    }),
  ],
})
