// แถบหัวหน้าจอ ใช้ร่วมกันทุกหน้า
// onBack = มีปุ่มย้อนกลับทางซ้าย, right = ปุ่มอื่นๆ ทางขวา
export default function PageHeader({ title, onBack, right }) {
  return (
    <header className="flex items-center gap-2 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-2">
      {onBack && (
        <button
          onClick={onBack}
          aria-label="ย้อนกลับ"
          className="-ml-2 flex size-10 shrink-0 items-center justify-center rounded-full active:bg-neutral-800"
        >
          <svg viewBox="0 0 24 24" className="size-6 fill-none stroke-current stroke-2" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}
      <div className="min-w-0 flex-1 text-lg font-semibold">{title}</div>
      {right}
    </header>
  )
}
