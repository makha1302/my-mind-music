import { db } from './db'
import { supabase } from './supabase'

// ซิงก์ 1 รอบ = ขาขึ้น (ส่งของที่ยังเป็น syncStatus 'local') แล้วตามด้วยขาลง (ดึงของจากเครื่องอื่น)
// ในเครื่องยังเป็นที่เก็บหลัก ถ้าพังกลางทาง (เน็ตหลุด, แอปถูกปิด) รอบหน้าก็ทำต่อจากที่ค้าง
// ไฟล์เสียงไม่ถูกดึงลงมาตอนซิงก์ โหลดตอนกดฟังเท่านั้น (downloadAudio)

const BUCKET = 'idea-clips'
// หลังแก้ข้อมูล รอแป๊บนึงก่อนส่ง เปลี่ยนชื่อหลายคลิปติดๆ กันจะได้ส่งรอบเดียว
const DEBOUNCE_MS = 2000

// ---------------------------------------------------------------------------
// แปลงแถวในเครื่อง (camelCase, เวลาเป็นมิลลิวินาที) ↔ แถวบนคลาวด์ (snake_case, timestamptz)
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

// ขากลับ: แถวบนคลาวด์ → แถวในเครื่อง (ไม่เอา user_id และ bpm/key ที่ยังไม่ได้ใช้)
const toMs = (iso) => Date.parse(iso)

function folderFromRow(row) {
  return {
    id: row.id,
    name: row.name,
    isAuto: row.is_auto,
    createdAt: toMs(row.created_at),
    updatedAt: toMs(row.updated_at),
  }
}

function clipFromRow(row) {
  return {
    id: row.id,
    sessionId: row.session_id,
    folderId: row.folder_id,
    name: row.name,
    storagePath: row.storage_path,
    mimeType: row.mime_type,
    duration: row.duration,
    status: 'done', // บนคลาวด์มีแต่คลิปที่อัดเสร็จแล้ว
    createdAt: toMs(row.created_at),
    updatedAt: toMs(row.updated_at),
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

// ---------------------------------------------------------------------------
// ดึงลง
// ---------------------------------------------------------------------------

// ดึงทุกแถวทุกรอบ (แค่ข้อมูล ไม่มีไฟล์เสียง เบามาก)
// ไม่ดึงเฉพาะที่เปลี่ยน เพราะต้องพึ่งนาฬิกาแต่ละเครื่องให้ตรงกัน เพี้ยนนิดเดียวของก็ตกหล่น
// Supabase ส่งได้ทีละไม่เกิน 1,000 แถว เลยดึงเป็นหน้าๆ
const PAGE_SIZE = 1000

async function fetchAll(tableName) {
  const rows = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .order('id')
      .range(from, from + PAGE_SIZE - 1)
    if (error) throw error
    rows.push(...data)
    if (data.length < PAGE_SIZE) return rows
  }
}

// รวมของจากคลาวด์เข้าเครื่อง: ใครมี updatedAt ใหม่กว่าชนะ (last-write-wins)
// - ในเครื่องไม่มี → เพิ่ม
// - ในเครื่องใหม่กว่าหรือเท่ากัน → ไม่แตะ (ถ้ายังเป็น 'local' เดี๋ยวรอบหน้าจะส่งขึ้นไปทับเอง)
// - คลาวด์ใหม่กว่า → ทับ แต่ไม่แตะฟิลด์ที่มีแค่ในเครื่อง เช่นไฟล์เสียงที่โหลดไว้แล้ว
async function mergeIntoLocal(table, remoteRows) {
  await db.transaction('rw', table, async () => {
    for (const remote of remoteRows) {
      const local = await table.get(remote.id)
      if (!local) {
        await table.add({ ...remote, syncStatus: 'synced' })
      } else if (remote.updatedAt > local.updatedAt) {
        await table.update(remote.id, { ...remote, syncStatus: 'synced' })
      }
    }
  })
}

async function pull() {
  // โฟลเดอร์ก่อน คลิปที่ดึงลงมาจะได้มีโฟลเดอร์ให้อยู่
  const folders = await fetchAll('idea_folders')
  await mergeIntoLocal(db.folders, folders.map(folderFromRow))
  const clips = await fetchAll('idea_clips')
  await mergeIntoLocal(db.clips, clips.map(clipFromRow))
}

async function runSync() {
  if (!navigator.onLine) return
  // getSession อ่านจากในเครื่อง ไม่ต้องต่อเน็ต ยังไม่ล็อกอิน = ไม่ซิงก์ ของค้าง 'local' ไว้ก่อน
  const { data } = await supabase.auth.getSession()
  const userId = data.session?.user.id
  if (!userId) return

  // ส่งก่อนดึง ของที่เพิ่งแก้ในเครื่องจะได้ขึ้นไปก่อน แล้วดึงกลับมาก็เป็นของล่าสุดอยู่แล้ว
  await pushFolders()
  await pushClips(userId)
  await pull()
}

// โหลดไฟล์เสียงของคลิปที่มาจากเครื่องอื่น แล้วเก็บไว้ในเครื่อง ครั้งหน้าฟังได้แม้ไม่มีเน็ต
export async function downloadAudio(clip) {
  if (!supabase || !clip.storagePath) throw new Error('คลิปนี้ไม่มีไฟล์บนคลาวด์')
  const { data, error } = await supabase.storage.from(BUCKET).download(clip.storagePath)
  if (error) throw error
  // ห่อใหม่ให้มีชนิดไฟล์ที่ถูกต้อง Safari ต้องรู้ชนิดไฟล์ถึงจะเล่นได้
  const blob = new Blob([data], { type: baseType(clip.mimeType) })
  await db.audio.put({ clipId: clip.id, blob })
  return blob
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
