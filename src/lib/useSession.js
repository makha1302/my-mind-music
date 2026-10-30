import { useEffect, useState } from 'react'
import { supabase } from './supabase'

// คืน session ของคนที่ล็อกอินอยู่
// undefined = กำลังเช็ก, null = ยังไม่ล็อกอิน (หรือยังไม่ได้ตั้งค่า Supabase)
export function useSession() {
  const [session, setSession] = useState(supabase ? undefined : null)

  useEffect(() => {
    if (!supabase) return
    // ถูกเรียกทันทีหนึ่งครั้งด้วย session ปัจจุบัน แล้วเรียกอีกทุกครั้งที่ล็อกอิน/ออก/ต่ออายุ
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession))
    return () => data.subscription.unsubscribe()
  }, [])

  return session
}
