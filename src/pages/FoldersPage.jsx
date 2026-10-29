import { useLiveQuery } from 'dexie-react-hooks'
import PageHeader from '../components/PageHeader'
import { getFoldersWithCounts } from '../lib/ideas'
import { goBack, navigate } from '../lib/useHashRoute'

// รายการโฟลเดอร์ทั้งหมด ใหม่สุดอยู่บน
export default function FoldersPage() {
  const folders = useLiveQuery(getFoldersWithCounts)

  return (
    <>
      <PageHeader title="📁 โฟลเดอร์" onBack={() => goBack('#/')} />

      <main className="flex-1 overflow-y-auto">
        {folders?.length === 0 && (
          <p className="mt-8 px-4 text-center text-neutral-500">ยังไม่มีโฟลเดอร์ กด "หมดไอเดีย" ในตะกร้าเพื่อสร้าง</p>
        )}

        <ul className="divide-y divide-neutral-800">
          {folders?.map((folder) => (
            <li key={folder.id}>
              <button
                onClick={() => navigate(`#/folder/${folder.id}`)}
                className="flex w-full items-center gap-3 px-4 py-4 text-left active:bg-neutral-900"
              >
                <span className="min-w-0 flex-1 truncate">{folder.name}</span>
                <span className="text-sm text-neutral-500">{folder.clipCount} คลิป</span>
              </button>
            </li>
          ))}
        </ul>
      </main>
    </>
  )
}
