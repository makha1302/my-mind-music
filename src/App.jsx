import { useEffect } from 'react'
import { recoverUnfinishedClips } from './lib/recorder'
import { useHashRoute } from './lib/useHashRoute'
import BasketPage from './pages/BasketPage'
import FolderPage from './pages/FolderPage'
import FoldersPage from './pages/FoldersPage'

export default function App() {
  const [page, param] = useHashRoute()

  // เปิดแอปปุ๊บ กู้คลิปที่ค้างจากรอบก่อน (แอปตายระหว่างอัด)
  useEffect(() => {
    recoverUnfinishedClips()
  }, [])

  return (
    // h-dvh = สูงเท่าจอพอดี แต่ละหน้าให้ส่วน main เลื่อนได้ในตัว ส่วนหัวกับท้ายอยู่กับที่
    <div className="flex h-dvh flex-col bg-neutral-950 text-neutral-100">
      {page === 'folders' && <FoldersPage />}
      {/* key={param} = เปลี่ยนโฟลเดอร์แล้วเริ่มหน้าใหม่ ไม่เอา state ของโฟลเดอร์เก่ามาปน */}
      {page === 'folder' && <FolderPage key={param} id={param} />}
      {page !== 'folders' && page !== 'folder' && <BasketPage />}
    </div>
  )
}
