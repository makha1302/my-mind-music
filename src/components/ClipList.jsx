import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState } from 'react'
import { db } from '../lib/db'
import { formatDuration } from '../lib/format'
import { renameClip } from '../lib/ideas'
import { supabase } from '../lib/supabase'
import { downloadAudio } from '../lib/sync'
import EditableName from './EditableName'

const SYNC_ICONS = {
  waiting: {
    label: 'รอขึ้นคลาวด์',
    path: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 7.5V12l3 2" />
      </>
    ),
  },
  synced: {
    label: 'ขึ้นคลาวด์แล้ว',
    path: <path d="M7 18a4.5 4.5 0 0 1-.5-8.97A6 6 0 0 1 18 9.5a4.25 4.25 0 0 1-.5 8.5z" />,
  },
  remote: {
    label: 'อยู่บนคลาวด์ ยังไม่ได้โหลดลงเครื่องนี้',
    path: (
      <>
        <path d="M12 4v11" />
        <path d="m7.5 10.5 4.5 4.5 4.5-4.5" />
        <path d="M5 19.5h14" />
      </>
    ),
  },
}

// ไอคอนเล็กข้างความยาว: นาฬิกา = รอขึ้นคลาวด์, เมฆ = ขึ้นแล้ว, ลูกศรลง = ยังไม่ได้โหลดลงเครื่องนี้
// สีจางๆ ไม่แย่งสายตาจากปุ่มอัด (ไม่โชว์ถ้ายังไม่ได้ตั้งค่า Supabase)
function SyncIcon({ state }) {
  const { label, path } = SYNC_ICONS[state]
  return (
    <svg
      viewBox="0 0 24 24"
      role="img"
      aria-label={label}
      className="size-3.5 fill-none stroke-current stroke-2 [stroke-linecap:round] [stroke-linejoin:round]"
    >
      <title>{label}</title>
      {path}
    </svg>
  )
}

// หน้าเดียวอาจมีหลายรายการ (ตะกร้า + จากเครื่องอื่น) กดเล่นรายการหนึ่ง อีกรายการต้องหยุด
const PLAY_EVENT = 'cliplist:play'

// รายการคลิป ใช้ได้ทั้งในตะกร้าและในโฟลเดอร์ หน้าที่เรียกเป็นคนบอกว่าจะโชว์คลิปไหน
// clips เป็น undefined ระหว่างโหลดครั้งแรก (จาก useLiveQuery) ก็ยังไม่ต้องโชว์อะไร
export default function ClipList({ clips, emptyText }) {
  const [playingId, setPlayingId] = useState(null)
  const [loadingId, setLoadingId] = useState(null)
  // ข้อความสั้นๆ ใต้คลิป เช่น "ต้องต่อเน็ตก่อน" { clipId, text }
  const [notice, setNotice] = useState(null)
  // ใช้ตัวเล่นเสียงตัวเดียวทั้งรายการ กดคลิปใหม่ คลิปเก่าจะหยุดเอง
  const audioRef = useRef(null)
  // คลิปไหนมีไฟล์เสียงอยู่ในเครื่องแล้ว (อ่านแค่คีย์ ไม่โหลดไฟล์)
  const localAudioIds = useLiveQuery(async () => new Set(await db.audio.toCollection().primaryKeys()), [])

  useEffect(() => {
    const audio = audioRef.current
    function onOtherPlay(event) {
      if (event.detail === audio) return
      audio.pause()
      setPlayingId(null)
    }
    window.addEventListener(PLAY_EVENT, onOtherPlay)
    return () => {
      window.removeEventListener(PLAY_EVENT, onOtherPlay)
      // ออกจากหน้านี้แล้วคืนหน่วยความจำของไฟล์ที่เปิดค้างไว้
      if (audio.src) URL.revokeObjectURL(audio.src)
    }
  }, [])

  // ไฟล์เสียงในเครื่อง ถ้าไม่มี (คลิปจากเครื่องอื่น) โหลดจากคลาวด์แล้วเก็บไว้
  async function loadAudio(clip) {
    const row = await db.audio.get(clip.id)
    if (row) return row.blob
    if (!navigator.onLine) throw new Error('ต้องต่อเน็ตก่อนฟังคลิปนี้ครั้งแรก')
    setLoadingId(clip.id)
    try {
      return await downloadAudio(clip)
    } catch (error) {
      console.warn('โหลดไฟล์เสียงไม่สำเร็จ', clip.id, error)
      throw new Error('โหลดไฟล์เสียงไม่สำเร็จ ลองใหม่อีกที')
    } finally {
      setLoadingId(null)
    }
  }

  async function togglePlay(clip) {
    const audio = audioRef.current
    setNotice(null)
    if (playingId === clip.id) {
      audio.pause()
      setPlayingId(null)
      return
    }

    // โหลดไฟล์เสียงตอนกดฟังเท่านั้น ไม่โหลดทุกคลิปตอนเปิดหน้า
    let blob
    try {
      blob = await loadAudio(clip)
    } catch (error) {
      setNotice({ clipId: clip.id, text: error.message })
      return
    }

    if (audio.src) URL.revokeObjectURL(audio.src)
    audio.src = URL.createObjectURL(blob)
    window.dispatchEvent(new CustomEvent(PLAY_EVENT, { detail: audio }))
    setPlayingId(clip.id)
    try {
      await audio.play()
    } catch (error) {
      setPlayingId(null)
      // Safari ไม่ยอมเล่นถ้ารอโหลดนานจนไม่นับว่าเป็นการแตะของผู้ใช้แล้ว ไฟล์อยู่ในเครื่องแล้ว แตะอีกทีเล่นได้เลย
      if (error.name === 'NotAllowedError') setNotice({ clipId: clip.id, text: 'โหลดเสร็จแล้ว แตะอีกครั้งเพื่อฟัง' })
      else setNotice({ clipId: clip.id, text: 'เล่นคลิปนี้ไม่ได้ (เครื่องนี้อาจไม่รองรับไฟล์ชนิดนี้)' })
    }
  }

  function syncState(clip) {
    if (clip.syncStatus !== 'synced') return 'waiting'
    // ระหว่างรอรายการไฟล์ในเครื่อง ให้ถือว่ามีไว้ก่อน ไอคอนจะได้ไม่กะพริบ
    return !localAudioIds || localAudioIds.has(clip.id) ? 'synced' : 'remote'
  }

  return (
    <>
      <audio ref={audioRef} onEnded={() => setPlayingId(null)} hidden />

      {clips?.length === 0 && <p className="mt-8 text-center text-neutral-500">{emptyText}</p>}

      <ul className="divide-y divide-neutral-800">
        {clips?.map((clip) => {
          const isRecording = clip.status === 'recording'
          const isPlaying = playingId === clip.id
          const isLoading = loadingId === clip.id
          return (
            <li key={clip.id} className="flex items-center gap-3 py-3">
              <button
                onClick={() => togglePlay(clip)}
                disabled={isRecording || isLoading}
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
                  {!isRecording && supabase && <SyncIcon state={syncState(clip)} />}
                  {isLoading && <span>กำลังโหลด...</span>}
                </p>
                {notice?.clipId === clip.id && <p className="text-sm text-amber-400">{notice.text}</p>}
              </div>
            </li>
          )
        })}
      </ul>
    </>
  )
}
