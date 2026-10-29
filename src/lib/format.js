const pad = (n) => String(n).padStart(2, '0')

// ชื่อคลิปเริ่มต้น เช่น "2026-10-30 16:38:05"
// ใส่วินาทีด้วย เพราะอัดหลายคลิปติดๆ กันในนาทีเดียวได้
export function defaultClipName(date) {
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  )
}

// ชื่อโฟลเดอร์เริ่มต้นตอนผู้ใช้ไม่ได้พิมพ์ชื่อ เช่น "2026-10-30 16:38"
export function defaultFolderName(date) {
  return defaultClipName(date).slice(0, -3)
}

// วินาที → "1:05"
export function formatDuration(seconds) {
  const total = Math.floor(seconds)
  return `${Math.floor(total / 60)}:${pad(total % 60)}`
}
