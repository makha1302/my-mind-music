import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { fileBasket, getFoldersWithCounts } from '../lib/ideas'

// แผ่นเลื่อนขึ้นจากล่างจอตอนกด "หมดไอเดีย"
// เลือกได้ว่าจะย้ายทั้งตะกร้าไปโฟลเดอร์ใหม่ หรือโฟลเดอร์เดิม (ไอเดียต่อยอดของเพลงเดิม)
export default function EndIdeaSheet({ clipCount, onClose }) {
  const folders = useLiveQuery(getFoldersWithCounts)
  const [newName, setNewName] = useState('')
  // กันกดซ้ำระหว่างกำลังย้าย
  const [busy, setBusy] = useState(false)

  async function moveTo(target) {
    setBusy(true)
    await fileBasket(target)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-10 flex flex-col justify-end bg-black/60" onClick={onClose}>
      {/* หยุด click ไม่ให้ทะลุไปถึงพื้นหลัง ไม่งั้นแตะในแผ่นแล้วแผ่นจะปิด */}
      <div
        onClick={(event) => event.stopPropagation()}
        className="flex max-h-[85dvh] flex-col rounded-t-2xl bg-neutral-900 px-4 pt-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
      >
        <h2 className="mb-3 text-center font-semibold">ย้าย {clipCount} คลิปไปที่...</h2>

        <form
          onSubmit={(event) => {
            event.preventDefault()
            moveTo({ newFolderName: newName })
          }}
          className="flex gap-2"
        >
          <input
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            placeholder="ชื่อโฟลเดอร์ใหม่ (เว้นว่างได้)"
            enterKeyHint="done"
            className="min-w-0 flex-1 rounded-lg bg-neutral-800 px-3 py-3 outline-none ring-1 ring-neutral-700 focus:ring-neutral-500"
          />
          <button disabled={busy} className="rounded-lg bg-red-600 px-4 font-medium disabled:opacity-50">
            สร้างใหม่
          </button>
        </form>

        {folders?.length > 0 && (
          <>
            <p className="mt-5 mb-1 text-sm text-neutral-500">หรือเพิ่มเข้าโฟลเดอร์เดิม</p>
            <ul className="-mx-4 overflow-y-auto">
              {folders.map((folder) => (
                <li key={folder.id}>
                  <button
                    disabled={busy}
                    onClick={() => moveTo({ folderId: folder.id })}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-neutral-800 disabled:opacity-50"
                  >
                    <span className="min-w-0 flex-1 truncate">📁 {folder.name}</span>
                    <span className="text-sm text-neutral-500">{folder.clipCount} คลิป</span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        <button onClick={onClose} className="mt-3 py-3 text-neutral-400">
          ยกเลิก
        </button>
      </div>
    </div>
  )
}
