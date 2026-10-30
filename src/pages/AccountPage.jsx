import { useState } from 'react'
import PageHeader from '../components/PageHeader'
import { supabase } from '../lib/supabase'
import { goBack } from '../lib/useHashRoute'
import { useSession } from '../lib/useSession'

// แปลง error จาก Supabase เป็นข้อความที่อ่านรู้เรื่อง
function loginErrorMessage(error) {
  if (error.code === 'invalid_credentials') return 'อีเมลหรือรหัสผ่านไม่ถูกต้อง'
  if (!navigator.onLine || error.name === 'AuthRetryableFetchError') {
    return 'ไม่มีเน็ต — ล็อกอินครั้งแรกต้องต่อเน็ตก่อน หลังจากนั้นใช้ออฟไลน์ได้'
  }
  return error.message
}

const inputClass =
  'w-full rounded-lg bg-neutral-800 px-3 py-3 outline-none ring-1 ring-neutral-700 focus:ring-neutral-500'

// #/account — ยังไม่ล็อกอิน = ฟอร์ม, ล็อกอินแล้ว = อีเมล + ปุ่มออกจากระบบ
export default function AccountPage() {
  const session = useSession()

  return (
    <>
      <PageHeader title="บัญชี" onBack={() => goBack('#/')} />
      <main className="flex-1 overflow-y-auto px-4 pt-4">
        {!supabase && (
          <p className="text-neutral-400">
            ยังไม่ได้ตั้งค่า Supabase (ไม่มี VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY) อัดเสียงในเครื่องได้ปกติ แต่ยังซิงก์ไม่ได้
          </p>
        )}
        {supabase && session === null && <LoginForm />}
        {session && <SignedIn email={session.user.email} />}
      </main>
    </>
  )
}

function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    // สำเร็จแล้วไม่ต้องทำอะไร useSession จะเปลี่ยนหน้าเป็น "ล็อกอินแล้ว" เอง
    if (error) setError(loginErrorMessage(error))
    setBusy(false)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <p className="text-sm text-neutral-400">ล็อกอินเพื่อซิงก์คลิปขึ้นคลาวด์ ไม่ล็อกอินก็อัดเสียงได้ปกติ</p>
      {/* autoComplete ช่วยให้ตัวจัดการรหัสผ่านของมือถือกรอกให้ได้ */}
      <input
        type="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="อีเมล"
        autoComplete="username"
        required
        className={inputClass}
      />
      <input
        type="password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        placeholder="รหัสผ่าน"
        autoComplete="current-password"
        required
        className={inputClass}
      />
      <button disabled={busy} className="rounded-lg bg-red-600 py-3 font-medium disabled:opacity-50">
        {busy ? 'กำลังล็อกอิน...' : 'ล็อกอิน'}
      </button>
      <p className="min-h-5 text-sm text-red-400">{error}</p>
    </form>
  )
}

function SignedIn({ email }) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-sm text-neutral-500">ล็อกอินอยู่ในชื่อ</p>
        <p className="truncate">{email}</p>
      </div>
      <button
        // scope 'local' = ออกจากระบบเฉพาะเครื่องนี้ และทำได้แม้ไม่มีเน็ต
        onClick={() => supabase.auth.signOut({ scope: 'local' })}
        className="rounded-lg bg-neutral-800 py-3 active:bg-neutral-700"
      >
        ออกจากระบบ
      </button>
      <p className="text-sm text-neutral-500">ออกจากระบบแล้ว คลิปในเครื่องยังอยู่ครบ</p>
    </div>
  )
}
