import { useEffect } from 'react'

const SHOW_MS = 6000

// แถบแจ้งเตือนด้านบน หายเองหลังไม่กี่วินาที แตะเพื่อปิดก่อนได้
export default function Toast({ message, onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, SHOW_MS)
    return () => clearTimeout(timer)
  }, [message, onClose])

  return (
    <button
      onClick={onClose}
      className="fixed inset-x-4 top-[max(1rem,env(safe-area-inset-top))] z-20 rounded-xl bg-neutral-800 px-4 py-3 text-left text-sm shadow-lg ring-1 ring-neutral-700"
    >
      {message}
    </button>
  )
}
