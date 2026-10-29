import { useEffect } from 'react'
import ClipList from './components/ClipList'
import RecordButton from './components/RecordButton'
import { recoverUnfinishedClips } from './lib/recorder'

export default function App() {
  // เปิดแอปปุ๊บ กู้คลิปที่ค้างจากรอบก่อน (แอปตายระหว่างอัด)
  useEffect(() => {
    recoverUnfinishedClips()
  }, [])

  return (
    // h-dvh = สูงเท่าจอพอดี รายการคลิปเลื่อนได้ในตัว ส่วนปุ่มอัดอยู่ล่างจอตลอด
    <div className="flex h-dvh flex-col bg-neutral-950 text-neutral-100">
      <header className="px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-2">
        <h1 className="text-lg font-semibold">🎙️ ห้องไอเดีย</h1>
      </header>

      <main className="flex-1 overflow-y-auto px-4">
        <ClipList />
      </main>

      <footer className="border-t border-neutral-900 px-4 pt-3 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <RecordButton />
      </footer>
    </div>
  )
}
