import { db } from './db'
import { supabase } from './supabase'

// ซิงก์ขาขึ้น: ส่งของที่ยังเป็น syncStatus 'local' ขึ้นคลาวด์
// ในเครื่องยังเป็นที่เก็บหลัก ถ้าพังกลางทาง (เน็ตหลุด, แอปถูกปิด) รอบหน้าก็ทำต่อจากที่ค้าง

const BUCKET = 'idea-clips'
// หลังแก้ข้อมูล รอแป๊บนึงก่อนส่ง เปลี่ยนชื่อหลายคลิปติดๆ กันจะได้ส่งรอบเดียว
const DEBOUNCE_MS = 2000

// ---------------------------------------------------------------------------
// แปลงแถวในเครื่อง (camelCase, เวลาเป็นมิลลิวินาที) → แถวบนคลาวด์ (snake_case, timestamptz)
// ไม่ส่ง user_id ฐานข้อมูลใส่ให้เองจากคนที่ล็อกอิน
// ---------------------------------------------------------------------------

const toIso = (ms) => new Date(ms).toISOString()

function folderToRow(folder) {
  return {
    id: folder.id,
    name: folder.name,
    is_auto: folder.isAuto,
    created_at: toIso(folder.createdAt),
    updated_at: toIso(folder.updatedAt),
  }
}

function clipToRow(clip) {
  return {
    id: clip.id,
    session_id: clip.sessionId,
    folder_id: clip.folderId ?? null,
    name: clip.name,
    storage_path: clip.storagePath,
    mime_type: clip.mimeType,
    duration: clip.duration,
    created_at: toIso(clip.createdAt),
    updated_at: toIso(clip.updatedAt),
  }
}

// 'audio/mp4;codecs=mp4a.40.2' → 'audio/mp4'
// bucket รับแค่ audio/* ส่วน codecs ต่อท้ายอาจทำให้ไม่ผ่าน เลยตัดออกตอนอัป
const baseType = (mimeType) => mimeType.split(';')[0].trim()

function fileExtension(mimeType) {
  const type = baseType(mimeType)
  if (type === 'audio/mp4') return 'm4a'
  if (type === 'audio/webm') return 'webm'
  if (type === 'audio/ogg') return 'ogg'
  return 'audio'
}

// ---------------------------------------------------------------------------
// ส่งขึ้น
// ---------------------------------------------------------------------------

// ตั้ง 'synced' เฉพาะแถวที่ไม่ถูกแก้ระหว่างส่ง (updatedAt ยังเท่าเดิม)
// ถ้าเปลี่ยนชื่อตอนกำลังอัปอยู่ ชื่อใหม่ยังเป็น 'local' แล้วจะถูกส่งรอบหน้า ไม่หาย
async function markSynced(table, sentRows) {
  await db.transaction('rw', table, async () => {
    for (const sent of sentRows) {
      const current = await table.get(sent.id)
      if (current && current.updatedAt === sent.updatedAt) {
        await table.update(sent.id, { syncStatus: 'synced' })
      }
    }
  })
}

// โฟลเดอร์ต้องขึ้นก่อนคลิป เพราะคลิปอ้างถึงโฟลเดอร์ ถ้าคลิปขึ้นก่อน ฐานข้อมูลจะปฏิเสธ
// ส่งรวดเดียวทุกโฟลเดอร์ (เป็นแค่ข้อความสั้นๆ)
async function pushFolders() {
  const folders = await db.folders.where('syncStatus').equals('local').toArray()
  if (folders.length === 0) return
  const { error } = await supabase.from('idea_folders').upsert(folders.map(folderToRow))
  if (error) throw error
  await markSynced(db.folders, folders)
}

async function pushClip(clip, userId) {
  let storagePath = clip.storagePath

  // ไฟล์เสียงอัปครั้งเดียวพอ เปลี่ยนชื่อทีหลังส่งแค่ข้อมูลแถว
  if (!storagePath) {
    const audio = await db.audio.get(clip.id)
    if (!audio) throw new Error(`ไม่เจอไฟล์เสียงของคลิป ${clip.id}`)
    const path = `${userId}/${clip.id}.${fileExtension(clip.mimeType)}`
    // upsert = อัปซ้ำได้ ถ้ารอบก่อนอัปไฟล์สำเร็จแต่ยังไม่ทันจด storagePath ก็ไม่พัง
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, audio.blob, { contentType: baseType(clip.mimeType), upsert: true })
    if (error) throw error
    storagePath = path
    // จดทันที ถ้าขั้นต่อไปพัง รอบหน้าจะไม่อัปไฟล์ซ้ำ (ไม่แตะ updatedAt เพราะผู้ใช้ไม่ได้แก้อะไร)
    await db.clips.update(clip.id, { storagePath })
  }

  const { error } = await supabase.from('idea_clips').upsert(clipToRow({ ...clip, storagePath }))
  if (error) throw error
  await markSynced(db.clips, [clip])
}

// ส่งทีละคลิป คลิปไหนพังก็ข้ามไปคลิปถัดไป รอบหน้าลองใหม่
// คลิปที่กำลังอัดอยู่ยังไม่ส่ง
async function pushClips(userId) {
  const clips = await db.clips
    .where('syncStatus')
    .equals('local')
    .filter((clip) => clip.status === 'done')
    .sortBy('createdAt')
  for (const clip of clips) {
    try {
      await pushClip(clip, userId)
    } catch (error) {
      console.warn('ส่งคลิปขึ้นคลาวด์ไม่สำเร็จ', clip.id, error)
    }
  }
}

async function runSync() {
  if (!navigator.onLine) return
  // getSession อ่านจากในเครื่อง ไม่ต้องต่อเน็ต ยังไม่ล็อกอิน = ไม่ซิงก์ ของค้าง 'local' ไว้ก่อน
  const { data } = await supabase.auth.getSession()
  const userId = data.session?.user.id
  if (!userId) return

  await pushFolders()
  await pushClips(userId)
}

// ---------------------------------------------------------------------------
// สั่งซิงก์
// ---------------------------------------------------------------------------

// วิ่งได้ทีละรอบเท่านั้น ถ้าถูกเรียกระหว่างวิ่ง จะวิ่งซ้ำอีกรอบตอนจบ ของที่เพิ่งแก้จะได้ไม่ตกรอบ
let running = null
let runAgain = false

export function syncNow() {
  if (!supabase) return Promise.resolve()
  if (running) {
    runAgain = true
    return running
  }
  running = (async () => {
    try {
      do {
        runAgain = false
        try {
          await runSync()
        } catch (error) {
          // ซิงก์พังต้องไม่ทำให้แอปพัง แค่จดไว้ดู รอบหน้าลองใหม่
          console.warn('ซิงก์ไม่สำเร็จ', error)
        }
      } while (runAgain)
    } finally {
      running = null
    }
  })()
  return running
}

// เรียกหลังแก้ข้อมูลทุกครั้ง ไม่ต้องรอผล
let timer = null
export function requestSync(delay = DEBOUNCE_MS) {
  if (!supabase) return
  clearTimeout(timer)
  timer = setTimeout(syncNow, delay)
}

// ต่อจังหวะซิงก์อัตโนมัติ: เปิดแอป / ล็อกอิน / กลับเข้าแอป / เน็ตกลับมา
// คืนฟังก์ชันสำหรับเลิกฟัง
export function startAutoSync() {
  if (!supabase) return () => {}

  // INITIAL_SESSION = ตอนเปิดแอป, SIGNED_IN = เพิ่งล็อกอิน
  // ใช้ requestSync (ตั้งเวลา) ไม่เรียก supabase ตรงๆ ในนี้ เพราะเรียกใน callback นี้แล้วค้างได้
  const { data } = supabase.auth.onAuthStateChange((event) => {
    if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') requestSync(0)
  })
  const onVisible = () => {
    if (document.visibilityState === 'visible') requestSync(0)
  }
  const onOnline = () => requestSync(0)

  document.addEventListener('visibilitychange', onVisible)
  window.addEventListener('online', onOnline)
  return () => {
    data.subscription.unsubscribe()
    document.removeEventListener('visibilitychange', onVisible)
    window.removeEventListener('online', onOnline)
  }
}
