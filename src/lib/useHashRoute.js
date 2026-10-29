import { useEffect, useState } from 'react'

// เส้นทางหน้าจอเก็บใน hash เช่น "#/folder/abc" → ['folder', 'abc']
// ใช้ hash เพราะท่าปัดย้อนกลับของแอนดรอยด์จะถอยกลับหน้าก่อน แทนที่จะออกจากแอป
// และ Vercel ไม่ต้องตั้งค่าอะไรเพิ่ม (ทุก URL ยังเป็นหน้า index.html หน้าเดียว)

function parse(hash) {
  return hash.replace(/^#\/?/, '').split('/').filter(Boolean)
}

function notify() {
  window.dispatchEvent(new Event('routechange'))
}

export function useHashRoute() {
  const [path, setPath] = useState(() => parse(location.hash))

  useEffect(() => {
    const update = () => setPath(parse(location.hash))
    // popstate = ผู้ใช้กดย้อนกลับ/ไปข้างหน้า, routechange = เราเปลี่ยนหน้าเองใน navigate()
    window.addEventListener('popstate', update)
    window.addEventListener('hashchange', update)
    window.addEventListener('routechange', update)
    return () => {
      window.removeEventListener('popstate', update)
      window.removeEventListener('hashchange', update)
      window.removeEventListener('routechange', update)
    }
  }, [])

  return path
}

// ไปหน้าใหม่ แล้วแปะป้าย inApp ไว้ จะได้รู้ว่าถอยกลับแล้วยังอยู่ในแอป
export function navigate(hash) {
  history.pushState({ inApp: true }, '', hash)
  notify()
}

// ปุ่มย้อนกลับบนจอ: ถ้ามาจากหน้าอื่นในแอป ถอยกลับเหมือนปัดย้อนกลับ
// ถ้าเปิดหน้านี้ตรงๆ (เช่นรีเฟรช) ไม่มีหน้าก่อนในแอป ก็ไปหน้า fallback แทน จะได้ไม่หลุดออกจากแอป
export function goBack(fallback) {
  if (history.state?.inApp) {
    history.back()
  } else {
    history.replaceState(null, '', fallback)
    notify()
  }
}
