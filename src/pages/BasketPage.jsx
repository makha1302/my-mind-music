import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import ClipList from '../components/ClipList'
import EndIdeaSheet from '../components/EndIdeaSheet'
import PageHeader from '../components/PageHeader'
import RecordButton from '../components/RecordButton'
import { getBasketClips } from '../lib/ideas'
import { supabase } from '../lib/supabase'
import { navigate } from '../lib/useHashRoute'
import { useSession } from '../lib/useSession'

// หน้าแรก: ตะกร้า + ปุ่มอัด + ปุ่มหมดไอเดีย
export default function BasketPage() {
  const clips = useLiveQuery(getBasketClips)
  const [sheetOpen, setSheetOpen] = useState(false)
  const session = useSession()
  // ไม่โชว์จุดแดงถ้ายังไม่ได้ตั้งค่า Supabase เพราะล็อกอินไม่ได้อยู่แล้ว
  const needsLogin = supabase && session === null

  // ดูจาก DB เลยว่ามีคลิปกำลังอัดอยู่ไหม ไม่ต้องส่ง state ข้ามคอมโพเนนต์
  const isRecording = clips?.some((clip) => clip.status === 'recording')
  const doneCount = clips?.filter((clip) => clip.status === 'done').length ?? 0

  return (
    <>
      <PageHeader
        title="🎙️ ห้องไอเดีย"
        right={
          <>
            <button onClick={() => navigate('#/folders')} className="rounded-full px-3 py-2 text-sm active:bg-neutral-800">
              📁 โฟลเดอร์
            </button>
            <button
              onClick={() => navigate('#/account')}
              aria-label={needsLogin ? 'บัญชี (ยังไม่ได้ล็อกอิน)' : 'บัญชี'}
              className="relative flex size-10 items-center justify-center rounded-full active:bg-neutral-800"
            >
              <svg viewBox="0 0 24 24" className="size-6 fill-none stroke-current stroke-2" aria-hidden="true">
                <circle cx="12" cy="8" r="4" />
                <path d="M4 21c0-4 3.6-6 8-6s8 2 8 6" strokeLinecap="round" />
              </svg>
              {/* จุดแดง = ยังไม่ล็อกอิน คลิปจะยังไม่ขึ้นคลาวด์ */}
              {needsLogin && <span className="absolute top-1.5 right-1.5 size-2.5 rounded-full bg-red-500" />}
            </button>
          </>
        }
      />

      <main className="flex-1 overflow-y-auto px-4">
        <p className="text-sm text-neutral-500">ตะกร้า</p>
        <ClipList clips={clips} emptyText="ตะกร้าว่าง ลองฮัมอะไรสักหน่อย" />
      </main>

      {/* 3 ช่อง: ว่าง | ปุ่มอัด (กลาง) | หมดไอเดีย (ขวา ใกล้นิ้วโป้งมือขวา) */}
      <footer className="grid grid-cols-[1fr_auto_1fr] items-center border-t border-neutral-900 px-4 pt-3 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <div />
        <RecordButton />
        <div className="flex justify-end">
          {doneCount > 0 && (
            <button
              onClick={() => setSheetOpen(true)}
              disabled={isRecording}
              className="rounded-full bg-neutral-800 px-4 py-3 text-sm font-medium active:bg-neutral-700 disabled:opacity-30"
            >
              หมดไอเดีย
            </button>
          )}
        </div>
      </footer>

      {sheetOpen && <EndIdeaSheet clipCount={doneCount} onClose={() => setSheetOpen(false)} />}
    </>
  )
}
