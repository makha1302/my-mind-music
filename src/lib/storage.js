// ขอให้เบราว์เซอร์เก็บข้อมูลในเครื่องถาวร ไม่ลบทิ้งเองตอนเครื่องเต็ม
// สำคัญเพราะคลิปที่ยังไม่ขึ้นคลาวด์อยู่ใน IndexedDB ที่เดียว
// Chrome มักให้เองถ้าติดตั้งเป็นแอป / ใช้บ่อย, Safari 17+ รองรับ ไม่มีหน้าต่างถามผู้ใช้
export async function requestPersistentStorage() {
  try {
    if (!navigator.storage?.persist) return false
    if (await navigator.storage.persisted()) return true
    return await navigator.storage.persist()
  } catch {
    return false
  }
}

// สำหรับหน้าบัญชี: ได้สิทธิ์เก็บถาวรหรือยัง + ใช้พื้นที่ไปกี่ MB (null = เบราว์เซอร์ไม่บอก)
export async function getStorageInfo() {
  try {
    const persisted = (await navigator.storage?.persisted?.()) ?? false
    const estimate = await navigator.storage?.estimate?.()
    return { persisted, usageMB: estimate?.usage != null ? estimate.usage / 1024 / 1024 : null }
  } catch {
    return { persisted: false, usageMB: null }
  }
}
