import { db } from './db'
import { defaultFolderName } from './format'
import { requestSync } from './sync'

// ทุกฟังก์ชันที่แก้ข้อมูล: ตั้ง syncStatus 'local' (= ยังไม่ขึ้นคลาวด์) แล้วเรียก requestSync()

// ตะกร้าของเครื่องนี้ = คลิปที่ยังไม่มีโฟลเดอร์ และเกิดในตะกร้าปัจจุบันของเครื่องนี้ (sessionId ตรงกัน)
// ทุกตะกร้าที่จบจะถูกย้ายเข้าโฟลเดอร์เสมอ แต่ละเครื่องเลยมีตะกร้าเดียวตลอด
// ต้องแยกตามเครื่อง เพราะหลังซิงก์ เครื่องอื่นจะเห็นคลิปที่ยังไม่มีโฟลเดอร์ของเราด้วย
// ถ้าไม่แยก ไอแพดจะไปย้ายคลิปที่แอนดรอยด์ยังอัดอยู่เข้า "ลืมกดหมดไอเดีย"

const SESSION_KEY = 'currentSessionId'

// อ่าน id ของตะกร้าปัจจุบันโดยไม่สร้างใหม่ (null = เครื่องนี้ยังไม่มีตะกร้าที่เปิดอยู่)
function peekSessionId() {
  try {
    return localStorage.getItem(SESSION_KEY)
  } catch {
    return null
  }
}

// id ของตะกร้าปัจจุบัน ไม่มีก็สร้างใหม่ = เริ่มตะกร้าใหม่ตอนอัดคลิปแรก
export function currentSessionId() {
  try {
    let id = localStorage.getItem(SESSION_KEY)
    if (!id) {
      id = crypto.randomUUID()
      localStorage.setItem(SESSION_KEY, id)
    }
    return id
  } catch {
    // บางโหมด (เช่นหน้าต่างส่วนตัว) localStorage ใช้ไม่ได้ ก็ใช้ตะกร้าชั่วคราวไป
    return crypto.randomUUID()
  }
}

function startNewSession() {
  try {
    localStorage.removeItem(SESSION_KEY)
  } catch {
    // ไม่เป็นไร คลิปถัดไปจะได้ session ชั่วคราวแทน
  }
}

// คลิปที่ยังไม่มีโฟลเดอร์ ใหม่สุดอยู่บน
function getUnfiledClips(filter) {
  return db.clips
    .orderBy('createdAt')
    .reverse()
    // IndexedDB ทำ index กับค่า null ไม่ได้ เลยต้องกรองทีละแถวแทน (คลิปไม่เยอะ ไม่ช้า)
    .filter((clip) => clip.folderId == null && filter(clip))
    .toArray()
}

// คลิปในตะกร้าของเครื่องนี้
export function getBasketClips() {
  const sessionId = peekSessionId()
  return getUnfiledClips((clip) => clip.sessionId === sessionId)
}

// คลิปที่ยังไม่มีโฟลเดอร์แต่ไม่ใช่ของตะกร้าเครื่องนี้ = ตะกร้าของเครื่องอื่นที่ยังไม่กดหมดไอเดีย
// เครื่องนี้ฟังได้ เปลี่ยนชื่อได้ แต่ไม่ย้าย ให้เครื่องเจ้าของเป็นคนย้ายเอง
export function getOtherDeviceBasketClips() {
  const sessionId = peekSessionId()
  return getUnfiledClips((clip) => clip.sessionId !== sessionId && clip.status === 'done')
}

// คลิปในโฟลเดอร์ ใหม่สุดอยู่บน
export function getFolderClips(folderId) {
  return db.clips.where('folderId').equals(folderId).reverse().sortBy('createdAt')
}

// โฟลเดอร์ทั้งหมดพร้อมจำนวนคลิป ใหม่สุดอยู่บน
export async function getFoldersWithCounts() {
  const [folders, clips] = await Promise.all([
    db.folders.orderBy('createdAt').reverse().toArray(),
    db.clips.toArray(),
  ])
  const counts = {}
  for (const clip of clips) {
    if (clip.folderId) counts[clip.folderId] = (counts[clip.folderId] ?? 0) + 1
  }
  return folders.map((folder) => ({ ...folder, clipCount: counts[folder.id] ?? 0 }))
}

async function createFolder(name, { isAuto = false } = {}) {
  const now = Date.now()
  const folder = {
    id: crypto.randomUUID(),
    name: name?.trim() || defaultFolderName(new Date(now)),
    isAuto,
    createdAt: now,
    updatedAt: now,
    syncStatus: 'local',
  }
  await db.folders.add(folder)
  return folder
}

// ปุ่ม "หมดไอเดีย": ย้ายทั้งตะกร้าเข้าโฟลเดอร์เดิม (folderId) หรือสร้างโฟลเดอร์ใหม่ (newFolderName)
// ทำใน transaction เดียว ถ้าพังกลางทางจะไม่มีโฟลเดอร์ว่างโผล่มา หรือคลิปย้ายไปครึ่งเดียว
export async function fileBasket({ folderId, newFolderName, isAuto = false }) {
  const sessionId = peekSessionId()
  await db.transaction('rw', db.folders, db.clips, async () => {
    const targetId = folderId ?? (await createFolder(newFolderName, { isAuto })).id
    // ย้ายเฉพาะตะกร้าของเครื่องนี้ และข้ามคลิปที่กำลังอัดอยู่ (ปกติปุ่มกดไม่ได้ระหว่างอัด แต่กันไว้ก่อน)
    await db.clips
      .filter((clip) => clip.folderId == null && clip.sessionId === sessionId && clip.status === 'done')
      .modify({ folderId: targetId, updatedAt: Date.now(), syncStatus: 'local' })
  })
  startNewSession()
  requestSync()
}

const AUTO_FOLDER_PATTERN = /^ลืมกดหมดไอเดีย (\d+)$/

// ลืมกด "หมดไอเดีย": ย้ายตะกร้าเข้า "ลืมกดหมดไอเดีย NN" แล้วคืนชื่อโฟลเดอร์
// เลขถัดไป = เลขมากสุดที่มีอยู่ + 1 (โฟลเดอร์ที่ถูกเปลี่ยนชื่อไปแล้วไม่นับ)
export async function fileForgottenBasket() {
  const autoFolders = await db.folders.filter((folder) => folder.isAuto).toArray()
  const numbers = autoFolders
    .map((folder) => folder.name.match(AUTO_FOLDER_PATTERN))
    .filter(Boolean)
    .map((match) => Number(match[1]))
  const next = Math.max(0, ...numbers) + 1
  const name = `ลืมกดหมดไอเดีย ${String(next).padStart(2, '0')}`
  await fileBasket({ newFolderName: name, isAuto: true })
  return name
}

export async function renameClip(id, name) {
  await db.clips.update(id, { name: name.trim(), updatedAt: Date.now(), syncStatus: 'local' })
  requestSync()
}

export async function renameFolder(id, name) {
  await db.folders.update(id, { name: name.trim(), updatedAt: Date.now(), syncStatus: 'local' })
  requestSync()
}
