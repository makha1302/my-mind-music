import { fileForgottenBasket, getBasketClips } from './ideas'

// กฎ: ออกจากแอปไปนานเกินนี้ แล้วตะกร้ายังมีคลิป = ลืมกด "หมดไอเดีย"
// ไม่สนว่าแอปถูกปิดจริงหรือแค่สลับแอป เพราะ Chrome บนแอนดรอยด์ชอบปิดแท็บเบื้องหลังเองจนแยกไม่ออก
export const AWAY_LIMIT_MS = 30 * 60 * 1000

const LEFT_AT_KEY = 'leftAppAt'

// เรียกตอนออกจากแอป (จอถูกซ่อน / ปิดหน้า) แค่จดเวลา ไม่แตะตะกร้า
export function rememberLeftApp() {
  try {
    localStorage.setItem(LEFT_AT_KEY, String(Date.now()))
  } catch {
    // จดไม่ได้ก็ไม่เป็นไร ยังมีเวลาของคลิปล่าสุดใช้แทน
  }
}

function readLeftAppAt() {
  try {
    return Number(localStorage.getItem(LEFT_AT_KEY)) || 0
  } catch {
    return 0
  }
}

async function run() {
  const clips = await getBasketClips()
  const done = clips.filter((clip) => clip.status === 'done')
  // ตะกร้าว่าง หรือกำลังอัดอยู่ = ไม่ต้องทำอะไร
  if (done.length === 0 || clips.some((clip) => clip.status === 'recording')) return null

  // ใช้เวลาล่าสุดระหว่าง "ออกจากแอป" กับ "อัดคลิปสุดท้ายเสร็จ"
  // กันกรณีแอปตายก่อนได้จดเวลาออก แล้วเวลาออกที่จดไว้เป็นของรอบเก่า
  const lastClipEnd = Math.max(...done.map((clip) => clip.createdAt + clip.duration * 1000))
  const lastActive = Math.max(readLeftAppAt(), lastClipEnd)
  if (Date.now() - lastActive < AWAY_LIMIT_MS) return null

  return fileForgottenBasket()
}

// เรียกตอนเปิดแอป และตอนกลับเข้าแอป
// คืนชื่อโฟลเดอร์ที่สร้าง หรือ null ถ้าไม่ได้ย้ายอะไร
let running = null
export function checkForgottenBasket() {
  // ถ้าถูกเรียกซ้อนกัน (เช่น React StrictMode) ใช้ผลรอบเดียวกัน ไม่งั้นจะได้โฟลเดอร์ซ้ำ
  running ??= run().finally(() => {
    running = null
  })
  return running
}
