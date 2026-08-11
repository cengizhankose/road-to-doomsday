import { Check } from "lucide-react"
import { useEffect, useState } from "react"

/**
 * Confirmation for a write the member asked for and the server accepted.
 *
 * `token` is a count of confirmed writes rather than a boolean, so the effect
 * keys off it *changing*. A React re-render passes the same token and is
 * ignored, which is what stops a second toast or a doubled burst.
 *
 * `message` and `confetti` belong to the control that was pressed. Saving and
 * scheduling are things achieved and get the burst; clearing a plan is an
 * undo, and gets the same plain acknowledgement without the party.
 *
 * Deliberately hand-rolled: a confetti dependency would ship far more than the
 * dozen-and-a-half absolutely-positioned spans this needs, and the animation is
 * a few lines of CSS in `index.css`.
 */

const PIECE_COUNT = 18
const TOAST_MS = 2_600
const BURST_MS = 1_500

interface Piece {
  id: number
  left: number
  delay: number
  duration: number
  drift: number
  rotation: number
  color: string
}

// Muted reds and bone-whites, so the burst reads as part of the app rather
// than a party trick pasted on top of it.
const COLORS = ["#e11d2e", "#f43f5e", "#fda4af", "#fafafa", "#a1a1aa"]

function makePieces(): Piece[] {
  return Array.from({ length: PIECE_COUNT }, (_, id) => ({
    id,
    left: Math.random() * 100,
    delay: Math.random() * 180,
    duration: 900 + Math.random() * 500,
    drift: (Math.random() - 0.5) * 90,
    rotation: Math.random() * 540 - 270,
    color: COLORS[id % COLORS.length],
  }))
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

export function SaveCelebration({
  token,
  message = "Progress saved",
  confetti = true,
}: {
  token: number
  message?: string
  confetti?: boolean
}) {
  // Seeded with the mount value: arriving on a page that already has saves
  // behind it is not itself a save.
  const [lastToken, setLastToken] = useState(token)
  const [burst, setBurst] = useState<{ id: number; pieces: Piece[] } | null>(
    null
  )
  // The message is captured with the token rather than read from the current
  // props, so a toast already on screen keeps announcing the write it was
  // raised for even if a later render carries different text.
  const [toast, setToast] = useState<{ id: number; message: string } | null>(
    null
  )

  // Reacting to a changed prop during render is the supported pattern here;
  // doing it in an effect would paint one frame before the confirmation.
  if (token !== lastToken) {
    setLastToken(token)
    if (token > 0) {
      setToast({ id: token, message })
      // The toast is the confirmation; the animation is decoration, and only
      // the decoration is dropped when the reader asked for less motion — or
      // when the write was not the kind worth celebrating.
      setBurst(
        confetti && !prefersReducedMotion()
          ? { id: token, pieces: makePieces() }
          : null
      )
    }
  }

  const toastId = toast?.id ?? null

  useEffect(() => {
    if (toastId === null) return
    const timer = window.setTimeout(() => setToast(null), TOAST_MS)
    return () => window.clearTimeout(timer)
  }, [toastId])

  useEffect(() => {
    if (!burst) return
    const timer = window.setTimeout(() => setBurst(null), BURST_MS)
    return () => window.clearTimeout(timer)
  }, [burst])

  const pieces = burst?.pieces ?? null

  return (
    <>
      {pieces ? (
        <div
          data-testid="confetti"
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-50 overflow-hidden"
        >
          {pieces.map((piece) => (
            <span
              key={piece.id}
              data-testid="confetti-piece"
              className="absolute top-0 block size-2 rounded-[1px] will-change-transform"
              style={{
                left: `${piece.left}%`,
                backgroundColor: piece.color,
                animation: `rtd-confetti-fall ${piece.duration}ms cubic-bezier(0.22, 0.61, 0.36, 1) ${piece.delay}ms both`,
                ["--rtd-confetti-drift" as string]: `${piece.drift}px`,
                ["--rtd-confetti-spin" as string]: `${piece.rotation}deg`,
              }}
            />
          ))}
        </div>
      ) : null}

      {toast ? (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center px-6"
        >
          <p className="flex items-center gap-2 rounded-full border border-white/10 bg-zinc-900/95 px-4 py-2 text-sm font-medium text-foreground shadow-lg backdrop-blur">
            <Check className="size-4 text-primary" aria-hidden="true" />
            {toast.message}
          </p>
        </div>
      ) : null}
    </>
  )
}
