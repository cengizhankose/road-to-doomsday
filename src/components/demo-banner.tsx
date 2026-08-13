import { FlaskConical } from "lucide-react"

/**
 * Sticky notice shown to anonymous visitors so they always know the tracker
 * they are looking at is their own private sandbox, not somebody else's data.
 * The banner appears on every route while `isDemo` is true, and never renders
 * for a signed-in household member.
 */
export function DemoBanner() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="border-b border-primary/20 bg-primary/10 px-4 py-2 text-xs text-primary"
    >
      <div className="flex items-center gap-2">
        <FlaskConical className="size-3.5 shrink-0" aria-hidden="true" />
        <p className="leading-snug">
          <span className="font-semibold uppercase tracking-[0.14em]">Demo</span>
          <span className="mx-1.5 text-primary/60" aria-hidden="true">·</span>
          Every change stays in this browser. Nothing you do here is shared or
          sent anywhere.
        </p>
      </div>
    </div>
  )
}
