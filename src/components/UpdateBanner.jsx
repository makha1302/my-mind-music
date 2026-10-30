import { useLiveQuery } from 'dexie-react-hooks'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { db } from '../lib/db'

// แถบ "มีเวอร์ชันใหม่" — แตะแล้วค่อยรีโหลด ไม่รีโหลดเอง เพราะถ้ากำลังอัดอยู่ การอัดจะโดนตัด
export default function UpdateBanner() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return
      // แอปบนมือถือแทบไม่เคยถูกปิดจริง เลยเช็กเวอร์ชันใหม่ทุกครั้งที่กลับเข้าแอปด้วย
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && navigator.onLine) registration.update().catch(() => {})
      })
    },
  })
  // ระหว่างกำลังอัด ไม่โชว์ จะได้ไม่เผลอแตะ
  const recordingCount = useLiveQuery(() => db.clips.where('status').equals('recording').count(), [])

  if (!needRefresh || recordingCount !== 0) return null

  return (
    <button
      onClick={() => updateServiceWorker()}
      className="fixed inset-x-4 top-[max(1rem,env(safe-area-inset-top))] z-20 rounded-xl bg-red-600 px-4 py-3 text-left text-sm font-medium shadow-lg"
    >
      มีเวอร์ชันใหม่ — แตะเพื่ออัปเดต
    </button>
  )
}
