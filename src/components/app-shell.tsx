import type { ReactNode } from "react"

import { BottomNav } from "@/components/bottom-nav"

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative mx-auto min-h-svh max-w-md overflow-x-hidden border-x border-white/[0.035] bg-background shadow-2xl shadow-black/40">
      <div className="pointer-events-none fixed inset-x-0 top-0 mx-auto h-72 max-w-md bg-[radial-gradient(circle_at_80%_-20%,rgba(185,28,28,0.22),transparent_55%)]" />
      <div className="relative">{children}</div>
      <BottomNav />
    </div>
  )
}
