import { useEffect, useRef, useState } from 'react'
import { db } from '../lib/db'
import { formatDuration } from '../lib/format'
import { renameClip } from '../lib/ideas'
import { supabase } from '../lib/supabase'
import EditableName from './EditableName'

// ไอคอนเล็กข้างความยาว: นาฬิกา = รอขึ้นคลาวด์, เมฆ = ขึ้นแล้ว
// สีจางๆ ไม่แย่งสายตาจากปุ่มอัด (ไม่โชว์ถ้ายังไม่ได้ตั้งค่า Supabase)
function SyncIcon({ synced }) {
  const label = synced ? 'ขึ้นคลาวด์แล้ว' : 'รอขึ้นคลาวด์'
  return (
    <svg
      viewBox="0 0 24 24"
      role="img"
      aria-label={label}
      className="size-3.5 fill-none stroke-current stroke-2 [stroke-linecap:round] [stroke-linejoin:round]"
    >
      <title>{label}</title>
      {synced ? (
        <path d="M7 18a4.5 4.5 0 0 1-.5-8.97A6 6 0 0 1 18 9.5a4.25 4.25 0 0 1-.5 8.5z" />
      ) : (
        <>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 7.5V12l3 2" />
        </>
      )}
    </svg>
  )
}

// รายการคลิป ใช้ได้ทั้งในตะกร้าและในโฟลเดอร์ หน้าที่เรียกเป็นคนบอกว่าจะโชว์คลิปไหน
// clips เป็น undefined ระหว่างโหลดครั้งแรก (จาก useLiveQuery) ก็ยังไม่ต้องโชว์อะไร
export default function ClipList({ clips, emptyText }) {
  const [playingId, setPlayingId] = useState(null)
  // ใช้ตัวเล่นเสียงตัวเดียวทั้งรายการ กดคลิปใหม่ คลิปเก่าจะหยุดเอง
  const audioRef = useRef(null)

  // ออกจากหน้านี้แล้วคืนหน่วยความจำของไฟล์ที่เปิดค้างไว้
  useEffect(() => {
    const audio = audioRef.current
    return () => {
      if (audio.src) URL.revokeObjectURL(audio.src)
    }
  }, [])

  async function togglePlay(clip) {
    const audio = audioRef.current
    if (playingId === clip.id) {
      audio.pause()
      setPlayingId(null)
      return
    }

    // โหลดไฟล์เสียงตอนกดฟังเท่านั้น ไม่โหลดทุกคลิปตอนเปิดหน้า
    const row = await db.audio.get(clip.id)
    if (!row) return
    if (audio.src) URL.revokeObjectURL(audio.src)
    audio.src = URL.createObjectURL(row.blob)
    setPlayingId(clip.id)
    try {
      await audio.play()
    } catch {
      setPlayingId(null)
    }
  }

  return (
    <>
      <audio ref={audioRef} onEnded={() => setPlayingId(null)} hidden />

      {clips?.length === 0 && <p className="mt-8 text-center text-neutral-500">{emptyText}</p>}

      <ul className="divide-y divide-neutral-800">
        {clips?.map((clip) => {
          const isRecording = clip.status === 'recording'
          const isPlaying = playingId === clip.id
          return (
            <li key={clip.id} className="flex items-center gap-3 py-3">
              <button
                onClick={() => togglePlay(clip)}
                disabled={isRecording}
                aria-label={isPlaying ? 'หยุดเล่น' : 'เล่น'}
                className="flex size-11 shrink-0 items-center justify-center rounded-full bg-neutral-800 disabled:opacity-30"
              >
                {/* ใช้ SVG แทนตัวอักษร ▶ เพราะบางเครื่องวาดเป็นอีโมจิสีฟ้า */}
                <svg viewBox="0 0 24 24" className="size-5 fill-current" aria-hidden="true">
                  {isPlaying ? <rect x="6" y="6" width="12" height="12" rx="1.5" /> : <path d="M8 5.5v13l10.5-6.5z" />}
                </svg>
              </button>
              <div className="min-w-0 flex-1">
                <EditableName value={clip.name} onSave={(name) => renameClip(clip.id, name)} />
                <p className="flex items-center gap-1.5 text-sm text-neutral-500">
                  {isRecording ? 'กำลังอัด...' : formatDuration(clip.duration)}
                  {!isRecording && supabase && <SyncIcon synced={clip.syncStatus === 'synced'} />}
                </p>
              </div>
            </li>
          )
        })}
      </ul>
    </>
  )
}
