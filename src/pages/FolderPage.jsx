import { useLiveQuery } from 'dexie-react-hooks'
import ClipList from '../components/ClipList'
import EditableName from '../components/EditableName'
import PageHeader from '../components/PageHeader'
import { db } from '../lib/db'
import { getFolderClips, renameFolder } from '../lib/ideas'
import { goBack } from '../lib/useHashRoute'

// คลิปในโฟลเดอร์เดียว แตะชื่อโฟลเดอร์บนหัวเพื่อเปลี่ยนชื่อได้
export default function FolderPage({ id }) {
  // แปลง "ไม่เจอ" เป็น null เพราะ useLiveQuery คืน undefined ระหว่างกำลังโหลด จะได้แยกออก
  const folder = useLiveQuery(async () => (await db.folders.get(id)) ?? null, [id])
  const clips = useLiveQuery(() => getFolderClips(id), [id])

  return (
    <>
      <PageHeader
        title={folder && <EditableName value={folder.name} onSave={(name) => renameFolder(id, name)} />}
        onBack={() => goBack('#/folders')}
      />

      <main className="flex-1 overflow-y-auto px-4">
        {folder === null ? (
          <p className="mt-8 text-center text-neutral-500">ไม่เจอโฟลเดอร์นี้</p>
        ) : (
          <ClipList clips={clips} emptyText="โฟลเดอร์นี้ยังไม่มีคลิป" />
        )}
      </main>
    </>
  )
}
