import { AlertTriangle, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { HttpError } from "@/lib/progress-client"

interface ActionErrorNoticeProps {
  error: unknown
  onRetry: () => void
  onDismiss: () => void
}

// A failed mutation is reported next to the tracker, never in place of it: the
// cached progress on screen is still valid and every control stays usable.
export function ActionErrorNotice({
  error,
  onRetry,
  onDismiss,
}: ActionErrorNoticeProps) {
  if (!error) return null

  const conflict = error instanceof HttpError && error.status === 409
  return (
    <div
      role="alert"
      className="mx-5 mb-4 flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-100"
    >
      <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p>
          {conflict
            ? "Shared progress changed on another device."
            : "That change could not be saved."}
        </p>
        <Button
          type="button"
          variant="link"
          size="sm"
          className="h-auto p-0 text-amber-100"
          onClick={onRetry}
        >
          Refresh
        </Button>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Dismiss this message"
        onClick={onDismiss}
        className="size-8 shrink-0 text-amber-100"
      >
        <X className="size-4" aria-hidden="true" />
      </Button>
    </div>
  )
}
