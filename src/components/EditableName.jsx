import { useRef, useState } from 'react'

// ชื่อที่แตะแล้วกลายเป็นช่องพิมพ์ ใช้ร่วมกันทั้งชื่อคลิปและชื่อโฟลเดอร์
// Enter หรือแตะที่อื่น = เซฟ, Esc หรือเว้นว่าง = ใช้ชื่อเดิม
export default function EditableName({ value, onSave, className = '' }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  // ตอนกด Esc เราสั่ง blur() ซึ่งจะไปเรียก commit ต่อ เลยต้องมีป้ายบอกว่า "ยกเลิกนะ ไม่ต้องเซฟ"
  const cancelledRef = useRef(false)

  function startEditing() {
    setDraft(value)
    cancelledRef.current = false
    setEditing(true)
  }

  function commit() {
    setEditing(false)
    const name = draft.trim()
    if (!cancelledRef.current && name && name !== value) onSave(name)
  }

  if (!editing) {
    return (
      <button onClick={startEditing} className={`block w-full truncate text-left ${className}`}>
        {value}
      </button>
    )
  }

  return (
    <input
      autoFocus
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onFocus={(event) => event.target.select()}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur()
        if (event.key === 'Escape') {
          cancelledRef.current = true
          event.currentTarget.blur()
        }
      }}
      enterKeyHint="done"
      className={`w-full rounded bg-neutral-800 px-1 outline-none ring-1 ring-neutral-600 ${className}`}
    />
  )
}
