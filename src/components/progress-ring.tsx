interface ProgressRingProps {
  value: number
  label: string
}

export function ProgressRing({ value, label }: ProgressRingProps) {
  const safeValue = Math.min(100, Math.max(0, value))
  const circumference = 2 * Math.PI * 26
  const offset = circumference - (safeValue / 100) * circumference

  return (
    <div className="relative size-16 shrink-0" role="img" aria-label={label}>
      <svg className="size-16 -rotate-90" viewBox="0 0 64 64" aria-hidden="true">
        <circle
          cx="32"
          cy="32"
          r="26"
          fill="none"
          stroke="currentColor"
          strokeWidth="5"
          className="text-white/8"
        />
        <circle
          cx="32"
          cy="32"
          r="26"
          fill="none"
          stroke="currentColor"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="text-primary transition-all duration-500"
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center text-xs font-semibold">
        {safeValue}%
      </span>
    </div>
  )
}
