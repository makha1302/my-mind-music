import { useState } from 'react'

// ขั้น 1.0: หน้าเปล่าของห้องไอเดีย
// ปุ่มอัดยังไม่อัดเสียงจริง (ทำในขั้น 1.1) ตอนนี้แค่ขอสิทธิ์ไมค์
// เพื่อเช็กว่าหลัง deploy ขึ้น HTTPS แล้วมือถือใช้ไมค์ได้จริง
export default function App() {
  // 'idle' | 'checking' | 'ok' | 'error'
  const [micStatus, setMicStatus] = useState('idle')
  const [errorMessage, setErrorMessage] = useState('')

  async function checkMic() {
    setMicStatus('checking')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      // ได้สิทธิ์แล้วปิดไมค์ทันที ไม่งั้นไฟไมค์บนจอจะค้าง
      stream.getTracks().forEach((track) => track.stop())
      setMicStatus('ok')
    } catch (err) {
      // ถ้าเปิดผ่าน http (ไม่ใช่ https หรือ localhost) navigator.mediaDevices จะไม่มี
      setErrorMessage(err.name || String(err))
      setMicStatus('error')
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-neutral-950 text-neutral-100">
      <header className="px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-2">
        <h1 className="text-lg font-semibold">🎙️ ห้องไอเดีย</h1>
      </header>

      <main className="flex-1 px-4">
        <p className="mt-8 text-center text-neutral-500">ตะกร้ายังว่าง ลองฮัมอะไรสักหน่อย</p>
      </main>

      {/* ปุ่มอัดอยู่ล่างจอ ให้กดด้วยนิ้วโป้งได้ตอนถือมือเดียว */}
      <footer className="flex flex-col items-center gap-3 px-4 pt-4 pb-[max(2rem,env(safe-area-inset-bottom))]">
        <button
          onClick={checkMic}
          disabled={micStatus === 'checking'}
          className="size-24 rounded-full bg-red-600 text-3xl shadow-lg active:scale-95 disabled:opacity-50"
          aria-label="อัดเสียง"
        >
          ●
        </button>
        <p className="h-5 text-sm text-neutral-400">
          {micStatus === 'ok' && 'ไมค์ใช้ได้ ✅'}
          {micStatus === 'error' && `ใช้ไมค์ไม่ได้: ${errorMessage}`}
          {micStatus === 'checking' && 'กำลังขอสิทธิ์ไมค์...'}
        </p>
      </footer>
    </div>
  )
}
