import { createClient } from '@supabase/supabase-js'

// ค่ามาจาก .env.local (ในเครื่อง) หรือ Environment Variables ใน Vercel
// ขึ้นต้นด้วย VITE_ = Vite ยอมให้โค้ดฝั่งเบราว์เซอร์อ่านได้
// คีย์นี้เปิดเผยได้ ความปลอดภัยจริงอยู่ที่ RLS ในฐานข้อมูล
const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

// ยังไม่ได้ตั้งค่า = null แอปยังอัดเสียงในเครื่องได้ปกติ แค่ซิงก์ไม่ได้
// session ถูกเก็บใน localStorage เอง ปิดเน็ตหรือปิดแอปก็ยังล็อกอินอยู่
export const supabase = url && key ? createClient(url, key) : null
