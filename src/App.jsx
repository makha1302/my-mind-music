import { useCallback, useEffect, useState } from 'react'
import Toast from './components/Toast'
import UpdateBanner from './components/UpdateBanner'
import { checkForgottenBasket, rememberLeftApp } from './lib/forgottenBasket'
import { recoverUnfinishedClips } from './lib/recorder'
import { requestPersistentStorage } from './lib/storage'
import { startAutoSync } from './lib/sync'
import { useHashRoute } from './lib/useHashRoute'
import AccountPage from './pages/AccountPage'
import BasketPage from './pages/BasketPage'
import FolderPage from './pages/FolderPage'
import FoldersPage from './pages/FoldersPage'

export default function App() {
  const [page, param] = useHashRoute()
  const [toast, setToast] = useState(null)
  // useCallback = ฟังก์ชันเดิมทุกครั้งที่วาดใหม่ ไม่งั้นตัวจับเวลาใน Toast จะเริ่มนับใหม่ตลอด
  const closeToast = useCallback(() => setToast(null), [])

  useEffect(() => {
    async function checkBasket() {
      const folderName = await checkForgottenBasket()
      if (folderName) setToast(`ย้ายตะกร้าเก่าไป "${folderName}" แล้ว`)
    }

    // เปิดแอป: กู้คลิปค้างก่อน คลิปที่กู้ได้จะได้ไปกับตะกร้าด้วย แล้วค่อยเช็กว่าลืมกดหมดไอเดียไหม
    recoverUnfinishedClips().then(checkBasket)

    // ออกจากแอป = จดเวลา, กลับเข้าแอป = เช็กว่าออกไปนานเกินไหม
    function handleVisibility() {
      if (document.visibilityState === 'hidden') rememberLeftApp()
      else checkBasket()
    }
    document.addEventListener('visibilitychange', handleVisibility)
    // pagehide กันไว้อีกชั้น บางเครื่องปิดหน้าโดยไม่ส่ง visibilitychange
    window.addEventListener('pagehide', rememberLeftApp)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('pagehide', rememberLeftApp)
    }
  }, [])

  // ซิงก์ขึ้นคลาวด์เองตอนเปิดแอป / ล็อกอิน / กลับเข้าแอป / เน็ตกลับมา
  useEffect(() => startAutoSync(), [])

  // ขอให้เบราว์เซอร์ไม่ลบข้อมูลในเครื่องทิ้งเอง (เรียกซ้ำได้ ถ้าได้แล้วก็แค่ตอบว่าได้)
  useEffect(() => {
    requestPersistentStorage()
  }, [])

  return (
    // h-dvh = สูงเท่าจอพอดี แต่ละหน้าให้ส่วน main เลื่อนได้ในตัว ส่วนหัวกับท้ายอยู่กับที่
    <div className="flex h-dvh flex-col bg-neutral-950 text-neutral-100">
      {page === 'folders' && <FoldersPage />}
      {/* key={param} = เปลี่ยนโฟลเดอร์แล้วเริ่มหน้าใหม่ ไม่เอา state ของโฟลเดอร์เก่ามาปน */}
      {page === 'folder' && <FolderPage key={param} id={param} />}
      {page === 'account' && <AccountPage />}
      {!['folders', 'folder', 'account'].includes(page) && <BasketPage />}

      {toast && <Toast message={toast} onClose={closeToast} />}
      <UpdateBanner />
    </div>
  )
}
