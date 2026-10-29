import { useEffect, useRef, useState } from 'react'
import { formatDuration } from '../lib/format'
import { startRecording } from '../lib/recorder'

// ปุ่มอัด/หยุด ใหญ่ๆ อยู่ล่างจอ ให้กดด้วยนิ้วโป้งได้ตอนถือมือเดียว
export default function RecordButton() {
  // 'idle' | 'starting' | 'recording' | 'stopping'
  const [state, setState] = useState('idle')
  const [elapsed, setElapsed] = useState(0)
  const [error, setError] = useState('')
  // ตัวควบคุมการอัดไม่ต้องเอาไปวาดบนจอ เลยเก็บใน ref แทน state
  const recordingRef = useRef(null)

  // ตัวจับเวลาบนปุ่ม อัปเดตเฉพาะตอนกำลังอัด
  useEffect(() => {
    if (state !== 'recording') return
    const startedAt = recordingRef.current.startedAt
    const timer = setInterval(() => setElapsed((performance.now() - startedAt) / 1000), 200)
    return () => clearInterval(timer)
  }, [state])

  async function handleClick() {
    setError('')

    if (state === 'recording') {
      setState('stopping')
      await recordingRef.current.stop()
      return
    }

    setState('starting')
    try {
      recordingRef.current = await startRecording({
        // ถูกเรียกทั้งตอนกดหยุดเอง และตอนการอัดถูกตัดจากภายนอก
        onStop: () => {
          recordingRef.current = null
          setElapsed(0)
          setState('idle')
        },
      })
      setState('recording')
    } catch (err) {
      setError(err.name === 'NotAllowedError' ? 'ยังไม่ได้อนุญาตให้ใช้ไมค์' : err.message || String(err))
      setState('idle')
    }
  }

  const isRecording = state === 'recording'
  const busy = state === 'starting' || state === 'stopping'

  return (
    <div className="flex flex-col items-center gap-3">
      <p className="h-6 font-mono text-lg tabular-nums text-red-400">
        {isRecording && formatDuration(elapsed)}
      </p>
      <button
        onClick={handleClick}
        disabled={busy}
        aria-label={isRecording ? 'หยุดอัด' : 'อัดเสียง'}
        className={`flex size-24 items-center justify-center rounded-full bg-red-600 shadow-lg transition active:scale-95 disabled:opacity-50 ${
          isRecording ? 'animate-pulse' : ''
        }`}
      >
        {/* วงกลม = อัด, สี่เหลี่ยม = หยุด เหมือนเครื่องอัดทั่วไป */}
        <span className={isRecording ? 'size-8 rounded-md bg-white' : 'size-8 rounded-full bg-white'} />
      </button>
      <p className="h-5 text-sm text-neutral-400">{error}</p>
    </div>
  )
}
