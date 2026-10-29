import { db } from './db'
import { defaultClipName } from './format'
import { currentSessionId } from './ideas'

// ฟอร์แมตที่อยากได้ เรียงจากชอบที่สุด
// mp4/AAC เปิดได้ทุกเครื่องรวมถึงไอแพด ถ้าเครื่องไม่รองรับค่อยถอยไปใช้ webm/opus
const MIME_CANDIDATES = [
  'audio/mp4;codecs=mp4a.40.2',
  'audio/mp4',
  'audio/webm;codecs=opus',
  'audio/webm',
]

// ส่งชิ้นเสียงออกมาทุกกี่มิลลิวินาที = แอปตายกลางทางจะเสียเสียงไปไม่เกินเท่านี้
const CHUNK_MS = 1000

function pickMimeType() {
  return MIME_CANDIDATES.find((type) => MediaRecorder.isTypeSupported(type)) ?? ''
}

// กันจอดับระหว่างอัด (จอดับแล้วเบราว์เซอร์มักหยุดอัด)
// บางเครื่องไม่รองรับ ไม่เป็นไร อัดต่อได้
async function requestWakeLock() {
  try {
    return await navigator.wakeLock?.request('screen')
  } catch {
    return null
  }
}

// เริ่มอัด แล้วคืนตัวควบคุมที่มี stop()
// onStop จะถูกเรียกเสมอเมื่อการอัดจบ ไม่ว่าผู้ใช้กดหยุดเอง หรือไมค์ถูกตัด (เช่นมีสายเข้า)
export async function startRecording({ onStop } = {}) {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('เบราว์เซอร์นี้อัดเสียงไม่ได้ (ต้องเปิดผ่าน https)')
  }

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  const preferred = pickMimeType()
  const recorder = new MediaRecorder(stream, preferred ? { mimeType: preferred } : undefined)
  const mimeType = recorder.mimeType || preferred || 'audio/webm'

  const id = crypto.randomUUID()
  const now = Date.now()
  const startedAt = performance.now()
  const elapsed = () => (performance.now() - startedAt) / 1000

  // สร้างแถวคลิปก่อนเริ่มอัด ถ้าแอปตายกลางทาง ตอนเปิดใหม่จะรู้ว่ามีคลิปค้างอยู่
  await db.clips.add({
    id,
    sessionId: currentSessionId(),
    folderId: null,
    name: defaultClipName(new Date(now)),
    mimeType,
    duration: 0,
    status: 'recording',
    createdAt: now,
    updatedAt: now,
    syncStatus: 'local',
  })

  // ต่อคิวการเขียนเป็นสายเดียว ชิ้นเสียงจะลง DB ตามลำดับเสมอ
  let index = 0
  let writes = Promise.resolve()

  recorder.ondataavailable = (event) => {
    if (event.data.size === 0) return
    const chunk = { clipId: id, index: index++, blob: event.data }
    const duration = elapsed()
    writes = writes.then(async () => {
      await db.chunks.add(chunk)
      // อัปเดตความยาวไปเรื่อยๆ ไว้ใช้ตอนกู้คลิปค้าง
      await db.clips.update(id, { duration })
    })
  }

  const wakeLock = await requestWakeLock()

  const done = new Promise((resolve) => {
    recorder.onstop = async () => {
      // ปิดไมค์ ไม่งั้นไฟไมค์บนจอจะค้าง
      stream.getTracks().forEach((track) => track.stop())
      wakeLock?.release().catch(() => {})
      // ชิ้นสุดท้ายมาก่อน event stop เสมอ รอให้เขียนลง DB ครบก่อนประกอบไฟล์
      await writes
      await finalizeClip(id, elapsed())
      onStop?.()
      resolve()
    }
  })

  recorder.start(CHUNK_MS)

  return {
    id,
    startedAt,
    stop() {
      if (recorder.state !== 'inactive') recorder.stop()
      return done
    },
  }
}

// เอาชิ้นเสียงทั้งหมดของคลิปมาต่อกันเป็นไฟล์เดียว แล้วเปลี่ยนสถานะเป็น done
// ทำใน transaction เดียว ถ้าพังกลางทางข้อมูลจะไม่ครึ่งๆ กลางๆ
async function finalizeClip(id, duration) {
  await db.transaction('rw', db.clips, db.chunks, db.audio, async () => {
    const clip = await db.clips.get(id)
    // กันการประกอบซ้ำ (เช่นถูกเรียกพร้อมกันสองที่)
    if (!clip || clip.status === 'done') return

    const chunks = await db.chunks.where('clipId').equals(id).sortBy('index')
    if (chunks.length === 0) {
      // แอปตายก่อนได้เสียงชิ้นแรก ไม่มีอะไรให้เก็บ
      await db.clips.delete(id)
      return
    }

    const blob = new Blob(
      chunks.map((chunk) => chunk.blob),
      { type: clip.mimeType },
    )
    await db.audio.put({ clipId: id, blob })
    await db.chunks.where('clipId').equals(id).delete()
    await db.clips.update(id, {
      status: 'done',
      duration: duration ?? clip.duration,
      updatedAt: Date.now(),
    })
  })
}

// เรียกตอนเปิดแอป: คลิปที่ยังค้างสถานะ recording = แอปตายระหว่างอัด
// ประกอบไฟล์จากชิ้นที่เซฟไว้แล้ว ใช้ความยาวล่าสุดที่จดไว้
let recovery = null
export function recoverUnfinishedClips() {
  // เรียกกี่ครั้งก็ทำจริงแค่ครั้งเดียว (React StrictMode ใน dev จะเรียก effect สองรอบ)
  recovery ??= (async () => {
    const stuck = await db.clips.where('status').equals('recording').toArray()
    for (const clip of stuck) {
      await finalizeClip(clip.id, clip.duration)
    }
  })()
  return recovery
}
