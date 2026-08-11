import { LockKeyhole } from "lucide-react"
import type { ReactNode } from "react"

import { HttpError } from "@/lib/progress-client"

interface PrivateAccessGateProps {
  loading: boolean
  error: unknown
  children: ReactNode
}

export function PrivateAccessGate({
  loading,
  error,
  children,
}: PrivateAccessGateProps) {
  if (loading) {
    return (
      <main className="grid min-h-svh place-items-center px-6 text-center">
        <p className="text-sm text-muted-foreground">
          Opening private tracker…
        </p>
      </main>
    )
  }

  if (error instanceof HttpError && error.status === 401) {
    return (
      <main className="grid min-h-svh place-items-center px-6 text-center">
        <div className="max-w-xs">
          <span className="mx-auto mb-5 grid size-12 place-items-center rounded-full bg-primary/12 text-primary">
            <LockKeyhole className="size-5" aria-hidden="true" />
          </span>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Private link required
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Open your personal Road to Doomsday magic link once on this device.
          </p>
        </div>
      </main>
    )
  }

  if (error) {
    return (
      <main className="grid min-h-svh place-items-center px-6 text-center">
        <div>
          <h1 className="font-heading text-xl font-semibold">
            Couldn&apos;t load the tracker
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Try again in a moment.
          </p>
        </div>
      </main>
    )
  }

  return children
}
