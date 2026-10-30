import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// สร้างไอคอนทุกขนาด (favicon, 64, 192, 512, maskable, apple-touch-icon) จาก public/icon.svg
// รันครั้งเดียวตอนเปลี่ยนไอคอน: npm run generate-pwa-assets
export default defineConfig({
  preset: {
    ...minimal2023Preset,
    // ไอคอนเรามีพื้นดำเต็มภาพอยู่แล้ว ไม่ต้องให้เติมขอบเพิ่ม
    maskable: { ...minimal2023Preset.maskable, padding: 0, resizeOptions: { background: '#0a0a0a' } },
    apple: { ...minimal2023Preset.apple, padding: 0, resizeOptions: { background: '#0a0a0a' } },
  },
  images: ['public/icon.svg'],
})
